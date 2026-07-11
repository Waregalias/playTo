import { Component, input, output } from '@angular/core';
import { UI_FR } from '@aldenfer/shared/content/fr';

/** One line in the action queue, as prepared by the shell (GameComponent). */
export interface QueueItemVm {
  id: string;
  kind: string;
  status: string;
  isCurrent: boolean;
}

/**
 * Small modal listing the action queue. Presentational only: the shell owns
 * the queue data and the cancel/close intents (kept out so the shell's own
 * style budget stays lean and the overlay mirrors combat-overlay/chat-drawer).
 */
@Component({
  selector: 'app-queue-modal',
  templateUrl: './queue-modal.html',
  styleUrl: './queue-modal.scss',
  host: { '(click)': 'close.emit()' },
})
export class QueueModalComponent {
  readonly t = UI_FR.queue;
  readonly items = input.required<QueueItemVm[]>();
  readonly countdown = input<string | null>(null);
  readonly cancel = output<string>();
  readonly close = output<void>();
}
