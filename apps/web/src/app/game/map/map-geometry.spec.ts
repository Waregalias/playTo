import { describe, expect, it } from 'vitest';
import type { HexDto } from '@aldenfer/shared';
import {
  boundsOf,
  byDepth,
  DEPTH,
  FLOOR_OFFSET,
  floorViews,
  projectCenter,
  shade,
  TILT,
  toTileView,
} from './map-geometry';

function hex(partial: Partial<HexDto> & Pick<HexDto, 'q' | 'r'>): HexDto {
  return {
    id: `${partial.q}:${partial.r}`,
    discovered: true,
    terrain: 'plain',
    poi: null,
    mistLevel: 0,
    ...partial,
  } as HexDto;
}

describe('map-geometry', () => {
  it('compresses the vertical axis by TILT, leaves x untouched', () => {
    const p = projectCenter(0, 2);
    // x uses the standard pointy-top formula, unaffected by TILT
    expect(p.x).toBeCloseTo(22 * Math.sqrt(3), 3);
    // y = 22 * 1.5 * 2 * TILT
    expect(p.y).toBeCloseTo(22 * 1.5 * 2 * TILT, 3);
    expect(TILT).toBeLessThan(1);
  });

  it('darkens a colour channel by the factor', () => {
    expect(shade('#8e9c6b', 0.5)).toBe('#474e36');
    expect(shade('#ffffff', 1)).toBe('#ffffff');
    expect(shade('#ffffff', 0)).toBe('#000000');
  });

  it('builds a perfect rhombus top face (4 points) and two wall skirts (4 points each)', () => {
    const view = toTileView(hex({ q: 0, r: 0 }));
    expect(view.topPoints.split(' ')).toHaveLength(4);
    expect(view.wallLeft.split(' ')).toHaveLength(4);
    expect(view.wallRight.split(' ')).toHaveLength(4);
    // walls are darker than the top face
    expect(view.wallLeftFill).not.toBe(view.topFill);
    expect(view.wallRightFill).not.toBe(view.topFill);
  });

  it('top face is a symmetric diamond centred on the tile', () => {
    const view = toTileView(hex({ q: 0, r: 0 }));
    const [top, right, bottom, left] = view.topPoints.split(' ').map((p) => {
      const [x, y] = p.split(',').map(Number);
      return { x, y };
    });
    // top/bottom sit on the vertical axis, right/left on the horizontal axis
    expect(top.x).toBeCloseTo(view.x, 5);
    expect(bottom.x).toBeCloseTo(view.x, 5);
    expect(right.y).toBeCloseTo(view.y, 5);
    expect(left.y).toBeCloseTo(view.y, 5);
    // symmetric around the centre on both axes
    expect(view.x - left.x).toBeCloseTo(right.x - view.x, 5);
    expect(view.y - top.y).toBeCloseTo(bottom.y - view.y, 5);
  });

  it('floorViews drops each tile one row-step lower, same x', () => {
    const hexes = [hex({ q: 0, r: 0 }), hex({ q: 1, r: 0 })];
    const [real0] = hexes.map(toTileView);
    const [floor0] = floorViews(hexes);
    expect(floor0.x).toBeCloseTo(real0.x, 5);
    expect(floor0.y).toBeCloseTo(real0.y + FLOOR_OFFSET, 5);
    expect(floorViews(hexes)).toHaveLength(2);
  });

  it('uses the fog fill and derived walls for undiscovered hexes', () => {
    const view = toTileView(hex({ q: 1, r: 1, discovered: false }));
    expect(view.topFill).toBe('#26313d');
  });

  it('orders tiles back-to-front by row then column', () => {
    const tiles = [hex({ q: 2, r: 1 }), hex({ q: 0, r: 0 }), hex({ q: 1, r: 0 })]
      .map(toTileView)
      .sort(byDepth);
    expect(tiles.map((t) => `${t.hex.q}:${t.hex.r}`)).toEqual(['0:0', '1:0', '2:1']);
  });

  it('returns a default box for an empty map', () => {
    expect(boundsOf([])).toEqual({ minX: 0, minY: 0, width: 340, height: 300 });
  });

  it('reserves margin, extrusion and floor-underlayer room in the bounds of a single hex', () => {
    // single hex at projected (0,0): min=max=0 → width = 2*MARGIN(40)
    const b = boundsOf([hex({ q: 0, r: 0 })]);
    expect(b.width).toBe(80);
    // height = 2*MARGIN + DEPTH + FLOOR_OFFSET + HALF_H, and HALF_H === FLOOR_OFFSET by construction
    expect(b.height).toBeCloseTo(80 + DEPTH + 2 * FLOOR_OFFSET, 5);
  });
});
