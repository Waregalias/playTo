import type { HexDto, Terrain } from '@aldenfer/shared';

/**
 * Pure rendering geometry for the hex map: a 3/4 top-down projection with
 * extruded tile blocks. No Angular dependency so it can be unit-tested in
 * isolation. The screen projection is the only thing that changes versus the
 * flat map; axial coordinates and adjacency (package `shared`) are untouched.
 */

const HEX_RADIUS = 22; // viewBox units, pointy-top (SPEC-M1 / maquette)
const SQRT3 = Math.sqrt(3);
const MARGIN = 40;

/** Vertical squish that fakes the 3/4 viewing tilt — low value = wide, flat diamonds. */
export const TILT = 0.42;
/** Downward extrusion of the block walls, in viewBox units (subtle). */
export const DEPTH = 6;
/** Vertical drop of the decorative underlayer, one row-step lower than its own tile. */
export const FLOOR_OFFSET = HEX_RADIUS * 1.5 * TILT;

/** Fog fill for undiscovered hexes (matches the previous flat rendering). */
const FOG_FILL = '#26313d';
/** Side-wall darkening, light read as coming from the upper-right. */
const WALL_RIGHT = 0.62; // lit facet
const WALL_LEFT = 0.45; // shadowed facet

// Terrain fills from DESIGN §4 (ford: cold water tone, same muted range).
export const TERRAIN_FILLS: Record<Terrain, string> = {
  plain: '#8e9c6b',
  forest: '#4f6b4a',
  hill: '#8a7b5c',
  marsh: '#5e6e63',
  ruins: '#6e6a72',
  ash_road: '#3d4854',
  ford: '#4a6272',
  shrine: '#b0885a',
};

export interface TileView {
  hex: HexDto;
  x: number; // top-face centre x
  y: number; // top-face centre y
  topPoints: string;
  wallLeft: string;
  wallRight: string;
  topFill: string;
  wallLeftFill: string;
  wallRightFill: string;
  shadowCx: number;
  shadowCy: number;
  shadowRx: number;
  shadowRy: number;
}

export function projectCenter(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_RADIUS * (SQRT3 * q + (SQRT3 / 2) * r),
    y: HEX_RADIUS * 1.5 * r * TILT,
  };
}

export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

type Point = { x: number; y: number };

const HALF_W = (HEX_RADIUS * SQRT3) / 2;
const HALF_H = HEX_RADIUS * 1.5 * TILT;

/**
 * Perfect rhombus (losange) top face: top/right/bottom/left points only.
 * Width/height derive from the same axial spacing used by projectCenter, so
 * neighbouring tiles interlock edge-to-edge with no gaps or overlap.
 */
function tiltedCorners(cx: number, cy: number): Point[] {
  return [
    { x: cx, y: cy - HALF_H }, // top
    { x: cx + HALF_W, y: cy }, // right
    { x: cx, y: cy + HALF_H }, // bottom
    { x: cx - HALF_W, y: cy }, // left
  ];
}

function toPoints(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export function toTileView(hex: HexDto): TileView {
  const { x, y } = projectCenter(hex.q, hex.r);
  const c = tiltedCorners(x, y);
  const down = (p: Point): Point => ({ x: p.x, y: p.y + DEPTH });
  const topFill = hex.discovered ? TERRAIN_FILLS[hex.terrain] : FOG_FILL;

  // Corner order (from tiltedCorners): 0=top, 1=right, 2=bottom, 3=left. The
  // two front-facing lower edges (right→bottom, bottom→left) become the
  // visible side walls once extruded downward.
  return {
    hex,
    x,
    y,
    topPoints: toPoints(c),
    wallRight: toPoints([c[1], c[2], down(c[2]), down(c[1])]),
    wallLeft: toPoints([c[2], c[3], down(c[3]), down(c[2])]),
    topFill,
    wallRightFill: shade(topFill, WALL_RIGHT),
    wallLeftFill: shade(topFill, WALL_LEFT),
    shadowCx: x,
    shadowCy: y + DEPTH + 3,
    shadowRx: HALF_W * 0.78,
    shadowRy: HALF_H * 0.32,
  };
}

export interface FloorTileView {
  x: number;
  y: number;
  points: string;
}

/**
 * Decorative underlayer, one row-step lower and much darker than the real
 * map — reads as a floor receding into the depths, filling the empty
 * viewBox space around and beneath the discovered hexes. No game data, no
 * adjacency: purely a copy of each real tile's footprint, dropped down by
 * FLOOR_OFFSET (so a discovered tile from the next row naturally covers the
 * interior copies, and only the perimeter peeks through).
 */
export function floorViews(hexes: readonly HexDto[]): FloorTileView[] {
  return hexes.map((hex) => {
    const { x, y } = projectCenter(hex.q, hex.r);
    const floorY = y + FLOOR_OFFSET;
    return { x, y: floorY, points: toPoints(tiltedCorners(x, floorY)) };
  });
}

/** Painter's-algorithm order: far rows first, then columns for determinism. */
export function byDepth(a: TileView, b: TileView): number {
  return a.hex.r - b.hex.r || a.hex.q - b.hex.q;
}

export function boundsOf(hexes: readonly HexDto[]): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  if (hexes.length === 0) return { minX: 0, minY: 0, width: 340, height: 300 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const hex of hexes) {
    const { x, y } = projectCenter(hex.q, hex.r);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  maxY += DEPTH + FLOOR_OFFSET + HALF_H; // walls + contact shadow + the floor underlayer
  return {
    minX: minX - MARGIN,
    minY: minY - MARGIN,
    width: maxX - minX + 2 * MARGIN,
    height: maxY - minY + 2 * MARGIN,
  };
}
