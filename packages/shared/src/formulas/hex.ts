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

/** All axial coordinates within `radius` steps of `center`, centre included (pointy-top). */
export function hexesInRange(center: AxialCoord, radius: number): AxialCoord[] {
  const out: AxialCoord[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    const lo = Math.max(-radius, -dq - radius);
    const hi = Math.min(radius, -dq + radius);
    for (let dr = lo; dr <= hi; dr++) {
      out.push({ q: center.q + dq, r: center.r + dr });
    }
  }
  return out;
}
