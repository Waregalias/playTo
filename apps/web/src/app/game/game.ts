import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UI_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { GameStore } from '../core/game-store';
import { ApiClient, ApiError } from '../core/api-client';
import { ToastService } from '../core/toast';
import { CharacterCreationComponent } from './character-creation';
import { MapScreenComponent } from './map/map-screen';

type Tab = 'map' | 'bastion' | 'hero' | 'raid';

@Component({
  selector: 'app-game',
  imports: [CharacterCreationComponent, MapScreenComponent],
  templateUrl: './game.html',
  styleUrl: './game.scss',
})
export class GameComponent implements OnInit, OnDestroy {
  readonly t = UI_FR;
  readonly store = inject(GameStore);
  readonly toast = inject(ToastService);
  private readonly api = inject(ApiClient);

  private readonly router = inject(Router);

  readonly tab = signal<Tab>('map');
  readonly tabs: Tab[] = ['map', 'bastion', 'hero', 'raid'];

  /** Display clock — ticks every second to recompute countdowns from endsAt (US6). */
  readonly nowMs = signal(Date.now());
  private ticker: ReturnType<typeof setInterval> | null = null;

  readonly countdown = computed(() => {
    const action = this.store.currentAction();
    if (!action) return null;
    const remaining = Math.max(0, new Date(action.endsAt).getTime() - this.nowMs());
    const minutes = Math.floor(remaining / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  });

  readonly queueLabel = computed(() => {
    const action = this.store.currentAction();
    if (!action) return null;
    const kind = action.type === 'rest' ? this.t.queue.rest : this.t.queue.move;
    const extra = this.store.actions().length - 1;
    return extra > 0 ? `${kind} (+${extra} ${this.t.queue.queued})` : kind;
  });

  readonly hpPercent = computed(() => {
    const c = this.store.character();
    return c ? Math.round((c.hp / c.hpMax) * 100) : 0;
  });

  readonly staminaPercent = computed(() => {
    const c = this.store.character();
    return c ? Math.round((c.stamina / c.staminaMax) * 100) : 0;
  });

  readonly className = computed(() => {
    const c = this.store.character();
    return c ? (this.t.creation.classes[c.class]?.name ?? c.class) : '';
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.store.load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await this.router.navigate(['/']);
        return;
      }
      this.toast.show(this.t.errors.loadFailed);
    }
    this.store.startPolling();
    this.ticker = setInterval(() => {
      this.nowMs.set(Date.now());
      const action = this.store.currentAction();
      if (action && new Date(action.endsAt).getTime() <= Date.now()) {
        void this.store.refresh().catch(() => undefined);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    this.store.stopPolling();
    if (this.ticker) clearInterval(this.ticker);
  }

  async onCharacterCreated(): Promise<void> {
    try {
      await this.store.load();
    } catch {
      this.toast.show(this.t.errors.loadFailed);
    }
  }

  async cancelQueued(actionId: string): Promise<void> {
    try {
      await this.api.cancelAction(actionId);
      await this.store.refresh();
    } catch (err) {
      this.toast.show(
        err instanceof ApiError && err.message ? err.message : ERROR_MESSAGES_FR.VALIDATION_ERROR,
      );
    }
  }
}
