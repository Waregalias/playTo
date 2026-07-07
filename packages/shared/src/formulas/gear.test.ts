import { describe, it, expect } from 'vitest';
import { deriveGearStats } from './gear.js';

describe('deriveGearStats', () => {
  it('leaves stats untouched above 0 durability', () => {
    expect(deriveGearStats({ power: 10 }, 40, 100)).toEqual({ power: 10 });
  });
  it('halves power and armor at exactly 0 durability, rounded', () => {
    expect(deriveGearStats({ power: 11 }, 0, 100)).toEqual({ power: 6 }); // round(5.5)
    expect(deriveGearStats({ armor: 7 }, 0, 100)).toEqual({ armor: 4 }); // round(3.5)
  });
  it('is a no-op when the item has no maxDurability (unbreakable / not gear)', () => {
    expect(deriveGearStats({ power: 10 }, null, null)).toEqual({ power: 10 });
  });
});
