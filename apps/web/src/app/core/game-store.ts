import { Injectable, computed, inject, signal } from '@angular/core';
import type { ActionDto, CharacterDto, HexDto, RegionDto } from '@aldenfer/shared';
import { ApiClient } from './api-client';

const POLL_INTERVAL_MS = 30_000; // SPEC-M1: 30 s polling, WebSocket lands in M3

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

  readonly currentAction = computed(() => this.actions()[0] ?? null);

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
    await Promise.all([this.refreshActions(), this.refreshHexes()]);
    this.loaded.set(true);
  }

  async refresh(): Promise<void> {
    const character = await this.api.getMe();
    if (character) this.character.set(character);
    await Promise.all([this.refreshActions(), this.refreshHexes()]);
  }

  async refreshActions(): Promise<void> {
    this.actions.set(await this.api.getActions());
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
