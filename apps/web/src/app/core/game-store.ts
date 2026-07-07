import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  ActionDto,
  ChatChannel,
  ChatMessageDto,
  CharacterDto,
  CharacterQuestDto,
  CombatStateDto,
  HexDto,
  InventoryEntryDto,
  ListingsPageDto,
  ProjectDetailDto,
  RegionDto,
} from '@aldenfer/shared';
import { ApiClient } from './api-client';

// SPEC-M1: 30 s polling. M3 adds WS invalidation (RealtimeService) as the primary
// signal; this stays as a low-frequency fallback net in case a reconnect is missed.
const POLL_INTERVAL_MS = 30_000;

/** Signal store for the M1 game state — character, action queue, hexes. */
@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly api = inject(ApiClient);

  readonly character = signal<CharacterDto | null>(null);
  readonly actions = signal<ActionDto[]>([]);
  readonly regions = signal<RegionDto[]>([]);
  readonly hexes = signal<HexDto[]>([]);
  readonly loaded = signal(false);
  readonly needsCharacter = signal(false);
  readonly combat = signal<CombatStateDto | null>(null);
  readonly quests = signal<CharacterQuestDto[]>([]);
  readonly inventory = signal<{ items: InventoryEntryDto[]; capacity: number; used: number }>({
    items: [],
    capacity: 30,
    used: 0,
  });
  readonly currentProject = signal<ProjectDetailDto | null>(null);
  readonly listings = signal<ListingsPageDto>({ items: [], nextCursor: null });
  readonly chatChannel = signal<ChatChannel>('global');
  readonly chatMessages = signal<ChatMessageDto[]>([]);
  readonly chatUnread = signal(false);

  readonly currentAction = computed(() => this.actions()[0] ?? null);
  readonly inCombat = computed(() => this.combat()?.status === 'active');

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async load(): Promise<void> {
    const character = await this.api.getMe();
    if (!character) {
      this.needsCharacter.set(true);
      this.loaded.set(true);
      return;
    }
    this.character.set(character);
    this.needsCharacter.set(false);
    if (character.activeCombatId) {
      this.combat.set(await this.api.getCurrentCombat());
    }
    await Promise.all([
      this.refreshActions(),
      this.refreshHexes(),
      this.refreshQuests(),
      this.refreshInventory(),
    ]);
    this.loaded.set(true);
  }

  async refresh(): Promise<void> {
    const character = await this.api.getMe();
    if (character) {
      this.character.set(character);
      // A Mistborn may be waiting after a resolution (US1).
      if (character.activeCombatId && this.combat()?.id !== character.activeCombatId) {
        this.combat.set(await this.api.getCurrentCombat());
      } else if (!character.activeCombatId && this.combat()?.status === 'active') {
        this.combat.set(null);
      }
    }
    await Promise.all([this.refreshActions(), this.refreshHexes(), this.refreshQuests(), this.refreshInventory()]);
  }

  async refreshActions(): Promise<void> {
    this.actions.set(await this.api.getActions());
  }

  async refreshQuests(): Promise<void> {
    this.quests.set(await this.api.getQuests());
  }

  async refreshInventory(): Promise<void> {
    this.inventory.set(await this.api.getInventory());
  }

  /**
   * Loads hexes of every unlocked region merged on the global grid, so
   * region borders (bastion gate → moors road) render as one seamless map.
   */
  async refreshHexes(): Promise<void> {
    const regions = await this.api.getRegions();
    this.regions.set(regions);
    const unlocked = regions.filter((r) => r.unlocked);
    const byId = new Map<string, HexDto>();
    for (const list of await Promise.all(unlocked.map((r) => this.api.getRegionHexes(r.id)))) {
      for (const hex of list) {
        const existing = byId.get(hex.id);
        if (!existing || (hex.discovered && !existing.discovered)) byId.set(hex.id, hex);
      }
    }
    this.hexes.set([...byId.values()]);
  }

  async refreshProject(projectId = 'r1.belfry'): Promise<void> {
    this.currentProject.set(await this.api.getProjectDetail(projectId));
  }

  async refreshListings(itemId?: string): Promise<void> {
    this.listings.set(await this.api.getListings(itemId));
  }

  async loadChatHistory(channel: ChatChannel): Promise<void> {
    this.chatChannel.set(channel);
    const history = await this.api.getChatHistory(channel);
    this.chatMessages.set([...history.items].reverse());
  }

  /** WS `chat.message` is a direct append, not a REST invalidation (SPEC-M3 US1). */
  appendChatMessage(msg: ChatMessageDto): void {
    if (msg.channel !== this.chatChannel()) return; // décision 7: no replay of missed events
    this.chatMessages.update((list) => [...list, msg]);
  }

  startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => void this.refresh().catch(() => undefined), POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
