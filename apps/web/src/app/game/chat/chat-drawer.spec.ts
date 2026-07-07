import { TestBed } from '@angular/core/testing';
import type { ChatMessageDto } from '@aldenfer/shared';
import { ChatDrawerComponent } from './chat-drawer';
import { GameStore } from '../../core/game-store';
import { RealtimeService } from '../../core/realtime';

describe('ChatDrawerComponent', () => {
  const storeMock = {
    chatChannel: vi.fn(() => 'global' as const),
    chatMessages: vi.fn((): ChatMessageDto[] => []),
    loadChatHistory: vi.fn().mockResolvedValue(undefined),
  };
  const realtimeMock = { sendChat: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    storeMock.chatChannel = vi.fn(() => 'global' as const);
    storeMock.chatMessages = vi.fn((): ChatMessageDto[] => []);
    await TestBed.configureTestingModule({
      imports: [ChatDrawerComponent],
      providers: [
        { provide: GameStore, useValue: storeMock },
        { provide: RealtimeService, useValue: realtimeMock },
      ],
    }).compileComponents();
  });

  it('renders messages from the store', () => {
    storeMock.chatMessages = vi.fn(() => [
      { id: '1', channel: 'global', characterId: 'c', characterName: 'Serelle', body: 'salut', at: '' },
    ]);
    const fixture = TestBed.createComponent(ChatDrawerComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="chat-msg-1"]')?.textContent).toContain('salut');
  });

  it('switches channel via the store', async () => {
    const fixture = TestBed.createComponent(ChatDrawerComponent);
    const component = fixture.componentInstance;
    await component.switchChannel('region:1');
    expect(storeMock.loadChatHistory).toHaveBeenCalledWith('region:1');
  });

  it('sends a trimmed message and clears the draft', () => {
    const fixture = TestBed.createComponent(ChatDrawerComponent);
    const component = fixture.componentInstance;
    component.draft.set('  salut le bastion  ');
    component.send();
    expect(realtimeMock.sendChat).toHaveBeenCalledWith('global', 'salut le bastion');
    expect(component.draft()).toBe('');
  });

  it('does not send a blank message', () => {
    const fixture = TestBed.createComponent(ChatDrawerComponent);
    const component = fixture.componentInstance;
    component.draft.set('   ');
    component.send();
    expect(realtimeMock.sendChat).not.toHaveBeenCalled();
  });
});
