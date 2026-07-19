import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import type { ChatChannel, ChatMessageDto, WsServerEvent } from '@aldenfer/shared';
import { UI_FR } from '@aldenfer/shared/content/fr';
import { GameStore } from './game-store';
import { ToastService } from './toast';

/** Minimal surface RealtimeService needs — the real ctor is `(url) => new WebSocket(url)`. */
export interface WsLike {
  onopen: (() => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  readyState: number;
  send(data: string): void;
  close(): void;
}

export const WEBSOCKET_FACTORY = new InjectionToken<(url: string) => WsLike>('WEBSOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url: string) => new WebSocket(url) as unknown as WsLike,
});

const HEARTBEAT_CHECK_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;
const MAX_BACKOFF_MS = 30_000;
const WS_OPEN = 1;

/** Exponential backoff, capped at 30 s (1s, 2s, 4s, 8s, 16s, 30s, 30s…). Pure. */
export function backoffDelayMs(attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
}

export type RefreshAction = 'character' | 'quests' | 'project' | null;

/**
 * Maps a server event `type` to the GameStore refresh it should trigger.
 * `chat.message` is handled separately (direct append, not a refresh — SPEC-M3 US1).
 * `chat.throttled` and `announce` need no store refresh. Pure.
 */
export function refreshActionFor(type: string): RefreshAction {
  switch (type) {
    case 'action.resolved':
    case 'stamina.full':
    case 'level.up':
      return 'character';
    case 'quest.updated':
      return 'quests';
    case 'project.progress':
      return 'project';
    default:
      return null;
  }
}

/**
 * Single-socket realtime client (SPEC-M3 US1/US2). Every server event other than
 * `chat.message` is an invalidation signal — it triggers a GameStore refresh rather
 * than applying the payload directly (décision 7: REST stays the source of truth).
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly store = inject(GameStore);
  private readonly wsFactory = inject(WEBSOCKET_FACTORY);
  private readonly toast = inject(ToastService);

  readonly connected = signal(false);
  readonly announce = signal<{ kind: string; [k: string]: unknown } | null>(null);

  private socket: WsLike | null = null;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastFrameAt = 0;
  private stopped = false;

  connect(): void {
    this.stopped = false;
    this.open();
  }

  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.connected.set(false);
  }

  sendChat(channel: ChatChannel, body: string): void {
    if (!this.socket || this.socket.readyState !== WS_OPEN) return;
    this.socket.send(JSON.stringify({ type: 'chat.send', channel, body }));
  }

  private open(): void {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = this.wsFactory(`${proto}//${location.host}/ws`);
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      this.connected.set(true);
      this.lastFrameAt = Date.now();
      // Reconnection catch-up (SPEC-M3 décision 7): re-derive state from REST, no replay.
      void this.store.refresh().catch(() => undefined);
      this.startHeartbeat();
    };
    socket.onmessage = (ev) => {
      this.lastFrameAt = Date.now();
      this.handleFrame(ev.data);
    };
    socket.onclose = () => {
      this.connected.set(false);
      this.stopHeartbeat();
      this.scheduleReconnect();
    };
    socket.onerror = () => socket.close();
  }

  private handleFrame(raw: string): void {
    let event: WsServerEvent;
    try {
      event = JSON.parse(raw) as WsServerEvent;
    } catch {
      return;
    }
    if (event.type === 'chat.message') {
      this.store.appendChatMessage(event.data as ChatMessageDto);
      return;
    }
    if (event.type === 'announce') {
      this.announce.set(event.data as { kind: string });
      return;
    }
    const msg = this.notificationMessage(event.type);
    if (msg) this.toast.show(msg);

    const action = refreshActionFor(event.type);
    if (action === 'character') void this.store.refresh().catch(() => undefined);
    else if (action === 'quests') void this.store.refreshQuests().catch(() => undefined);
    else if (action === 'project') void this.store.refreshProject().catch(() => undefined);
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const delay = backoffDelayMs(this.attempt++);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastFrameAt > HEARTBEAT_TIMEOUT_MS) {
        this.socket?.close(); // triggers onclose → reconnect
      }
    }, HEARTBEAT_CHECK_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private notificationMessage(type: string): string | null {
    const n = UI_FR.notifications;
    switch (type) {
      case 'action.resolved': return n.actionResolved;
      case 'level.up': return n.levelUp;
      case 'stamina.full': return n.staminaFull;
      case 'quest.updated': return n.questUpdated;
      case 'project.progress': return n.projectProgress;
      default: return null;
    }
  }
}
