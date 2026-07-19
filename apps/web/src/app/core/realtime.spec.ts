import { TestBed } from '@angular/core/testing';
import type { ChatMessageDto } from '@aldenfer/shared';
import {
  RealtimeService,
  WEBSOCKET_FACTORY,
  backoffDelayMs,
  refreshActionFor,
  type WsLike,
} from './realtime';
import { GameStore } from './game-store';
import { ApiClient } from './api-client';
import { ToastService } from './toast';

class FakeSocket implements WsLike {
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0; // CONNECTING
  readonly sent: string[] = [];
  closed = false;

  constructor(public readonly url: string) {}

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }

  emitOpen(): void {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  emitMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe('backoffDelayMs', () => {
  it('doubles each attempt, capped at 30s', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(backoffDelayMs)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
  });
});

describe('refreshActionFor', () => {
  it('maps character-channel events to a character refresh', () => {
    expect(refreshActionFor('action.resolved')).toBe('character');
    expect(refreshActionFor('stamina.full')).toBe('character');
    expect(refreshActionFor('level.up')).toBe('character');
  });
  it('maps quest.updated to a quests refresh', () => {
    expect(refreshActionFor('quest.updated')).toBe('quests');
  });
  it('maps project.progress to a project refresh', () => {
    expect(refreshActionFor('project.progress')).toBe('project');
  });
  it('has no refresh action for chat.message or announce', () => {
    expect(refreshActionFor('chat.message')).toBeNull();
    expect(refreshActionFor('announce')).toBeNull();
    expect(refreshActionFor('unknown.thing')).toBeNull();
  });
});

describe('RealtimeService', () => {
  let sockets: FakeSocket[];
  let storeMock: { refresh: ReturnType<typeof vi.fn>; refreshQuests: ReturnType<typeof vi.fn>; refreshProject: ReturnType<typeof vi.fn>; appendChatMessage: ReturnType<typeof vi.fn> };
  let toastMock: { show: ReturnType<typeof vi.fn>; message: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    storeMock = {
      refresh: vi.fn().mockResolvedValue(undefined),
      refreshQuests: vi.fn().mockResolvedValue(undefined),
      refreshProject: vi.fn().mockResolvedValue(undefined),
      appendChatMessage: vi.fn(),
    };
    toastMock = { show: vi.fn(), message: vi.fn(() => null) };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiClient, useValue: {} },
        { provide: GameStore, useValue: storeMock },
        { provide: ToastService, useValue: toastMock },
        {
          provide: WEBSOCKET_FACTORY,
          useValue: (url: string) => {
            const s = new FakeSocket(url);
            sockets.push(s);
            return s;
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a socket to /ws and reports connected on open', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toMatch(/\/ws$/);
    expect(service.connected()).toBe(false);
    sockets[0].emitOpen();
    expect(service.connected()).toBe(true);
    expect(storeMock.refresh).toHaveBeenCalled();
  });

  it('appends a chat.message frame to the store, without a full refresh', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    storeMock.refresh.mockClear();
    const msg: ChatMessageDto = {
      id: 'm1',
      channel: 'global',
      characterId: 'c1',
      characterName: 'Serelle',
      body: 'salut',
      at: new Date().toISOString(),
    };
    sockets[0].emitMessage({ channel: 'global', type: 'chat.message', data: msg, at: msg.at });
    expect(storeMock.appendChatMessage).toHaveBeenCalledWith(msg);
    expect(storeMock.refresh).not.toHaveBeenCalled();
  });

  it('triggers a character refresh on action.resolved, not a chat append', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    storeMock.refresh.mockClear();
    sockets[0].emitMessage({ channel: 'character:c1', type: 'action.resolved', data: {}, at: '' });
    expect(storeMock.refresh).toHaveBeenCalled();
    expect(storeMock.appendChatMessage).not.toHaveBeenCalled();
  });

  it('triggers a quests refresh on quest.updated', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    sockets[0].emitMessage({ channel: 'character:c1', type: 'quest.updated', data: {}, at: '' });
    expect(storeMock.refreshQuests).toHaveBeenCalled();
  });

  it('triggers a project refresh on project.progress', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    sockets[0].emitMessage({ channel: 'region:1', type: 'project.progress', data: {}, at: '' });
    expect(storeMock.refreshProject).toHaveBeenCalled();
  });

  it('sends chat only once the socket is open, with the exact frame shape', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    service.sendChat('global', 'trop tôt');
    expect(sockets[0].sent).toHaveLength(0);
    sockets[0].emitOpen();
    service.sendChat('global', 'salut');
    expect(sockets[0].sent).toEqual([JSON.stringify({ type: 'chat.send', channel: 'global', body: 'salut' })]);
  });

  it('reconnects with exponential backoff after a close', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    sockets[0].close();
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(backoffDelayMs(0));
    expect(sockets).toHaveLength(2);
  });

  it('stops reconnecting after disconnect()', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    service.disconnect();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
    expect(service.connected()).toBe(false);
  });

  it('shows a toast notification on action.resolved', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    toastMock.show.mockClear();
    sockets[0].emitMessage({ channel: 'character:c1', type: 'action.resolved', data: {}, at: '' });
    expect(toastMock.show).toHaveBeenCalledWith('Action terminée.');
  });

  it('shows a toast notification on level.up', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    toastMock.show.mockClear();
    sockets[0].emitMessage({ channel: 'character:c1', type: 'level.up', data: {}, at: '' });
    expect(toastMock.show).toHaveBeenCalledWith('Niveau supérieur !');
  });

  it('does not show a toast for chat.message or announce', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    toastMock.show.mockClear();
    sockets[0].emitMessage({ channel: 'global', type: 'chat.message', data: { id: 'm1', channel: 'global', characterId: 'c1', characterName: 'X', body: 'hi', at: '' }, at: '' });
    sockets[0].emitMessage({ channel: 'global', type: 'announce', data: { kind: 'test' }, at: '' });
    expect(toastMock.show).not.toHaveBeenCalled();
  });
});
