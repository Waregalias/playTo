import { Component, computed, inject, signal } from '@angular/core';
import { isAdjacent, moveCost, movePayloadSchema, TERRAINS, type MistLevel } from '@aldenfer/shared';
import { REGION_NAMES_FR, UI_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { ApiClient, ApiError } from '../../core/api-client';
import { GameStore } from '../../core/game-store';
import { ToastService } from '../../core/toast';
import { terrainVignetteUrl } from '../../core/asset-url';
import {
  boundsOf,
  byDepth,
  floorViews,
  toTileView,
  TERRAIN_FILLS,
  type FloorTileView,
  type TileView,
} from './map-geometry';

@Component({
  selector: 'app-map-screen',
  templateUrl: './map-screen.html',
  styleUrl: './map-screen.scss',
})
export class MapScreenComponent {
  readonly t = UI_FR.map;
  readonly tExtra = UI_FR.mapExtra;
  readonly store = inject(GameStore);
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  readonly selectedId = signal<string | null>(null);
  readonly pending = signal(false);

  readonly regionName = computed(() => {
    const character = this.store.character();
    const region = this.store.regions().find((r) => r.id === character?.regionId);
    return region ? (REGION_NAMES_FR[region.slug] ?? region.slug) : '';
  });

  readonly regionMist = computed(() => {
    const character = this.store.character();
    return this.store.regions().find((r) => r.id === character?.regionId)?.mistLevel ?? 0;
  });

  /** Where the character will stand once the queue has run (US3). */
  readonly virtualHexId = computed(() => {
    const lastMove = [...this.store.actions()].reverse().find((a) => a.type === 'move');
    if (lastMove) {
      const parsed = movePayloadSchema.safeParse(lastMove.payload);
      if (parsed.success) return parsed.data.targetHexId;
    }
    return this.store.character()?.hexId ?? null;
  });

  readonly bounds = computed(() => boundsOf(this.store.hexes()));

  readonly viewBox = computed(() => {
    const b = this.bounds();
    return `${b.minX} ${b.minY} ${b.width} ${b.height}`;
  });

  readonly hexViews = computed<TileView[]>(() => this.store.hexes().map(toTileView).sort(byDepth));

  /** Decorative underlayer — one row-step lower, much darker (depth cue only). */
  readonly floorTiles = computed<FloorTileView[]>(() => floorViews(this.store.hexes()));

  readonly playerView = computed(() => {
    const hexId = this.store.character()?.hexId;
    return this.hexViews().find((v) => v.hex.id === hexId) ?? null;
  });

  readonly selectedView = computed(
    () => this.hexViews().find((v) => v.hex.id === this.selectedId()) ?? null,
  );

  /** Static terrain swatch legend, in game order (DESIGN §4 fills). */
  readonly terrainLegend = TERRAINS.map((terrain) => ({
    id: terrain,
    label: this.t.terrains[terrain] ?? terrain,
    color: TERRAIN_FILLS[terrain],
  }));

  readonly terrainVignette = computed(() => {
    const view = this.selectedView();
    return view?.hex.discovered ? terrainVignetteUrl(view.hex.terrain) : null;
  });

  /** Panel view-model for the selected hex. */
  readonly panel = computed(() => {
    const view = this.selectedView();
    if (!view) return { title: this.t.pickHexTitle, hint: this.t.pickHexHint } as PanelVm;

    const from = this.hexViews().find((v) => v.hex.id === this.virtualHexId());
    const adjacent =
      !!from && isAdjacent({ q: from.hex.q, r: from.hex.r }, { q: view.hex.q, r: view.hex.r });
    const isHere = view.hex.id === this.store.character()?.hexId;

    if (!view.hex.discovered) {
      return {
        title: this.t.fogTitle,
        hint: adjacent ? this.t.mistTax : this.t.fogHint,
        canMove: adjacent,
        costLabel: '?',
        timeLabel: '?',
      } as PanelVm;
    }

    const terrainName = this.t.terrains[view.hex.terrain] ?? view.hex.terrain;
    const poiName = view.hex.poi ? (this.t.poiNames?.[view.hex.poi.type] ?? view.hex.poi.type) : null;
    const title = poiName ? `${terrainName} — ${poiName}` : terrainName;
    const subtitle = `${this.t.mistTag} ${view.hex.mistLevel}`;
    const description = this.t.terrainDescriptions?.[view.hex.terrain] ?? '';

    if (isHere) {
      const canRest = view.hex.terrain === 'shrine';
      // Bastion POIs are services, not dig sites (SPEC-M2 US4).
      const canSearch = !!view.hex.poi && this.store.character()?.regionId !== 0;
      return { title, subtitle, description, hint: this.t.hereSuffix, canRest, canSearch } as PanelVm;
    }
    if (!adjacent) {
      return { title, subtitle, description, hint: this.t.tooFar } as PanelVm;
    }

    const cost = moveCost(view.hex.terrain, (view.hex.mistLevel ?? 0) as MistLevel);
    return {
      title,
      subtitle,
      description,
      hint: this.store.actions().length > 0 ? this.t.queuedFromHint : this.t.mistTax,
      canMove: true,
      costLabel: String(cost.stamina),
      timeLabel: formatDuration(cost.durationSeconds),
    } as PanelVm;
  });

  select(hexId: string): void {
    this.selectedId.set(hexId);
  }

  async move(): Promise<void> {
    const view = this.selectedView();
    if (!view || this.pending()) return;
    this.pending.set(true);
    try {
      await this.api.postAction({ type: 'move', targetHexId: view.hex.id });
      await this.store.refresh();
      this.selectedId.set(null);
    } catch (err) {
      this.toast.show(errorMessage(err));
    } finally {
      this.pending.set(false);
    }
  }

  async rest(): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    try {
      await this.api.postAction({ type: 'rest' });
      await this.store.refresh();
      this.selectedId.set(null);
    } catch (err) {
      this.toast.show(errorMessage(err));
    } finally {
      this.pending.set(false);
    }
  }

  async search(): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    try {
      await this.api.postAction({ type: 'search' });
      await this.store.refresh();
      this.selectedId.set(null);
    } catch (err) {
      this.toast.show(errorMessage(err));
    } finally {
      this.pending.set(false);
    }
  }
}

interface PanelVm {
  title: string;
  subtitle?: string;
  description?: string;
  hint: string;
  canMove?: boolean;
  canRest?: boolean;
  canSearch?: boolean;
  costLabel?: string;
  timeLabel?: string;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.message) return err.message;
  return ERROR_MESSAGES_FR.VALIDATION_ERROR;
}
