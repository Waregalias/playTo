import { Component, computed, inject, signal } from '@angular/core';
import {
  isAdjacent,
  moveCost,
  movePayloadSchema,
  type HexDto,
  type MistLevel,
  type Terrain,
} from '@aldenfer/shared';
import { REGION_NAMES_FR, UI_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { ApiClient, ApiError } from '../../core/api-client';
import { GameStore } from '../../core/game-store';
import { ToastService } from '../../core/toast';

const HEX_RADIUS = 22; // viewBox units, pointy-top (SPEC-M1 / maquette)
const SQRT3 = Math.sqrt(3);
const MARGIN = 30;

// Terrain fills from DESIGN §4 (ford: cold water tone, same muted range).
const TERRAIN_FILLS: Record<Terrain, string> = {
  plain: '#8E9C6B',
  forest: '#4F6B4A',
  hill: '#8A7B5C',
  marsh: '#5E6E63',
  ruins: '#6E6A72',
  ash_road: '#3D4854',
  ford: '#4A6272',
  shrine: '#B0885A',
};

interface HexView {
  hex: HexDto;
  x: number;
  y: number;
  points: string;
  fill: string;
}

function center(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_RADIUS * (SQRT3 * q + (SQRT3 / 2) * r),
    y: HEX_RADIUS * 1.5 * r,
  };
}

function corners(x: number, y: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${(x + HEX_RADIUS * Math.cos(angle)).toFixed(1)},${(y + HEX_RADIUS * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

@Component({
  selector: 'app-map-screen',
  templateUrl: './map-screen.html',
  styleUrl: './map-screen.scss',
})
export class MapScreenComponent {
  readonly t = UI_FR.map;
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

  private readonly bounds = computed(() => {
    const hexes = this.store.hexes();
    if (hexes.length === 0) return { minX: 0, minY: 0, width: 340, height: 300 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const hex of hexes) {
      const { x, y } = center(hex.q, hex.r);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return {
      minX: minX - MARGIN,
      minY: minY - MARGIN,
      width: maxX - minX + 2 * MARGIN,
      height: maxY - minY + 2 * MARGIN,
    };
  });

  readonly viewBox = computed(() => {
    const b = this.bounds();
    return `${b.minX} ${b.minY} ${b.width} ${b.height}`;
  });

  readonly hexViews = computed<HexView[]>(() =>
    this.store.hexes().map((hex) => {
      const { x, y } = center(hex.q, hex.r);
      return {
        hex,
        x,
        y,
        points: corners(x, y),
        fill: hex.discovered ? TERRAIN_FILLS[hex.terrain] : '#26313D',
      };
    }),
  );

  readonly playerView = computed(() => {
    const hexId = this.store.character()?.hexId;
    return this.hexViews().find((v) => v.hex.id === hexId) ?? null;
  });

  readonly selectedView = computed(
    () => this.hexViews().find((v) => v.hex.id === this.selectedId()) ?? null,
  );

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
    const title = view.hex.poi ? `${terrainName} — ${view.hex.poi.type}` : terrainName;

    if (isHere) {
      const canRest = view.hex.terrain === 'shrine';
      return { title, hint: this.t.hereSuffix, canRest } as PanelVm;
    }
    if (!adjacent) {
      return { title, hint: this.t.tooFar } as PanelVm;
    }

    const cost = moveCost(view.hex.terrain, (view.hex.mistLevel ?? 0) as MistLevel);
    return {
      title,
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
}

interface PanelVm {
  title: string;
  hint: string;
  canMove?: boolean;
  canRest?: boolean;
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
