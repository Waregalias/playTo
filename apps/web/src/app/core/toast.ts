import { Injectable, signal } from '@angular/core';

const TOAST_DURATION_MS = 2400; // DESIGN §3: one toast at a time, 2.4 s

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string): void {
    this.message.set(message);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.message.set(null), TOAST_DURATION_MS);
  }
}
