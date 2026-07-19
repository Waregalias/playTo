import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { UI_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { GameStore } from '../core/game-store';
import { ApiClient, ApiError } from '../core/api-client';
import { RealtimeService } from '../core/realtime';
import { ToastService } from '../core/toast';
import { CharacterCreationComponent } from './character-creation';
import { MapScreenComponent } from './map/map-screen';
import { CombatOverlayComponent } from './combat/combat-overlay';
import { HeroScreenComponent } from './hero/hero-screen';
import { BastionScreenComponent } from './bastion/bastion-screen';
import { ChatDrawerComponent } from './chat/chat-drawer';
import { QueueModalComponent } from './queue/queue-modal';
import { heroPortraitUrl } from '../core/asset-url';

type Tab = 'map' | 'bastion' | 'hero' | 'raid';

@Component({
  selector: 'app-game',
  imports: [
    CharacterCreationComponent,
    MapScreenComponent,
    CombatOverlayComponent,
    HeroScreenComponent,
    BastionScreenComponent,
    ChatDrawerComponent,
    QueueModalComponent,
  ],
  templateUrl: './game.html',
  styleUrl: './game.scss',
})
export class GameComponent implements OnInit, OnDestroy {
  readonly t = UI_FR;
  readonly store = inject(GameStore);
  readonly toast = inject(ToastService);
  readonly realtime = inject(RealtimeService);
  private readonly api = inject(ApiClient);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly tabs: Tab[] = ['map', 'bastion', 'hero', 'raid'];

  /** Active tab, driven by the URL (/game/:tab) so screens are bookmarkable. */
  private readonly tabParam = toSignal(this.route.paramMap.pipe(map((p) => p.get('tab'))));
  readonly tab = computed<Tab>(() => {
    const param = this.tabParam();
    return this.tabs.includes(param as Tab) ? (param as Tab) : 'map';
  });

  go(tab: Tab): void {
    void this.router.navigate(['/game', tab]);
  }
  readonly chatOpen = signal(false);
  readonly queueOpen = signal(false);

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

  private actionKind(type: string): string {
    if (type === 'rest') return this.t.queue.rest;
    if (type === 'search') return this.t.queue.search;
    return this.t.queue.move;
  }

  readonly queueLabel = computed(() => {
    const action = this.store.currentAction();
    if (!action) return null;
    const kind = this.actionKind(action.type);
    const extra = this.store.actions().length - 1;
    return extra > 0 ? `${kind} (+${extra} ${this.t.queue.queued})` : kind;
  });

  /** Ordered queue for the modal: current action first, then those waiting behind it. */
  readonly queueItems = computed(() =>
    [...this.store.actions()]
      .sort((a, b) => a.position - b.position)
      .map((action) => ({
        id: action.id,
        kind: this.actionKind(action.type),
        status: action.position === 0 ? this.t.queue.current : this.t.queue.waiting,
        isCurrent: action.position === 0,
      })),
  );

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

  readonly avatarPortrait = computed(() => {
    const c = this.store.character();
    return c ? heroPortraitUrl(c.class) : null;
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
    if (!this.store.needsCharacter()) this.realtime.connect();
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
    this.realtime.disconnect();
    if (this.ticker) clearInterval(this.ticker);
  }

  async onCharacterCreated(): Promise<void> {
    try {
      await this.store.load();
      this.realtime.connect();
    } catch {
      this.toast.show(this.t.errors.loadFailed);
    }
  }

  toggleChat(): void {
    const opening = !this.chatOpen();
    this.chatOpen.set(opening);
    if (opening && this.store.chatMessages().length === 0) {
      void this.store.loadChatHistory(this.store.chatChannel()).catch(() => undefined);
    }
  }

  async cancelQueued(actionId: string): Promise<void> {
    try {
      await this.api.cancelAction(actionId);
      await this.store.refresh();
      if (this.store.actions().length === 0) this.queueOpen.set(false);
    } catch (err) {
      this.toast.show(
        err instanceof ApiError && err.message ? err.message : ERROR_MESSAGES_FR.VALIDATION_ERROR,
      );
    }
  }
}
