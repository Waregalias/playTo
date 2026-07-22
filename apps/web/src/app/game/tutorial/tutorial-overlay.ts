import { Component, inject, output, signal } from '@angular/core';
import { UI_FR } from '@aldenfer/shared/content/fr';
import { ApiClient } from '../../core/api-client';

@Component({
  selector: 'app-tutorial-overlay',
  templateUrl: './tutorial-overlay.html',
  styleUrl: './tutorial-overlay.scss',
})
export class TutorialOverlayComponent {
  readonly t = UI_FR.tutorial;
  readonly done = output<void>();
  private readonly api = inject(ApiClient);

  readonly step = signal(0);
  readonly total = this.t.steps.length;

  next(): void {
    if (this.step() < this.total - 1) {
      this.step.update((s) => s + 1);
    } else {
      this.complete();
    }
  }

  skip(): void {
    this.complete();
  }

  private async complete(): Promise<void> {
    await this.api.completeTutorial();
    this.done.emit();
  }
}
