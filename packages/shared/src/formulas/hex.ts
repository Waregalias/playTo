export interface AxialCoord {
  q: number;
  r: number;
}

const AXIAL_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

/** True when two axial coordinates are adjacent (pointy-top hex grid). */
export function isAdjacent(a: AxialCoord, b: AxialCoord): boolean {
  return AXIAL_DIRECTIONS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
}

/** The six neighbours of an axial coordinate. */
export function neighbours(c: AxialCoord): AxialCoord[] {
  return AXIAL_DIRECTIONS.map(([dq, dr]) => ({ q: c.q + dq, r: c.r + dr }));
}
