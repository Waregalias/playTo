import { Component, inject, signal } from '@angular/core';
import type { ChatChannel } from '@aldenfer/shared';
import { UI_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { GameStore } from '../../core/game-store';
import { RealtimeService } from '../../core/realtime';
import { ApiError } from '../../core/api-client';
import { ToastService } from '../../core/toast';

@Component({
  selector: 'app-chat-drawer',
  templateUrl: './chat-drawer.html',
  styleUrl: './chat-drawer.scss',
})
export class ChatDrawerComponent {
  readonly t = UI_FR.chat;
  readonly store = inject(GameStore);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);

  readonly draft = signal('');
  readonly pending = signal(false);

  async switchChannel(channel: ChatChannel): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    try {
      await this.store.loadChatHistory(channel);
    } catch (err) {
      this.toast.show(
        err instanceof ApiError && err.message ? err.message : ERROR_MESSAGES_FR.VALIDATION_ERROR,
      );
    } finally {
      this.pending.set(false);
    }
  }

  send(): void {
    const body = this.draft().trim();
    if (!body) return;
    this.realtime.sendChat(this.store.chatChannel(), body);
    this.draft.set('');
  }
}
