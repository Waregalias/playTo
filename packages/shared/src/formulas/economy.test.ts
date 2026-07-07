import { describe, it, expect } from 'vitest';
import { repairCost, contributionCredit, marketTax, itemTierFromId } from './economy.js';

describe('repairCost', () => {
  it('is zero when nothing is missing', () => {
    expect(repairCost(0, 1)).toBe(0);
    expect(repairCost(-5, 2)).toBe(0);
  });
  it('scales per missing point for a tier-1 item', () => {
    expect(repairCost(40, 1)).toBe(40);
  });
  it('applies the tier factor', () => {
    expect(repairCost(40, 2)).toBe(60); // ×1.5
  });
  it('rounds up', () => {
    expect(repairCost(3, 2)).toBe(5); // 3 × 1.5 = 4.5 → 5
  });
});

describe('contributionCredit', () => {
  it('is identity at ×1', () => {
    expect(contributionCredit(100, 1)).toBe(100);
  });
  it('applies the Offrande multiplier and floors', () => {
    expect(contributionCredit(100, 1.4)).toBe(140);
    expect(contributionCredit(3, 1.4)).toBe(4); // 4.2 → 4
  });
});

describe('marketTax', () => {
  it('is 5 % of the gross, floored', () => {
    expect(marketTax(100)).toBe(5);
    expect(marketTax(199)).toBe(9); // 9.95 → 9
    expect(marketTax(0)).toBe(0);
  });
});

describe('itemTierFromId', () => {
  it('parses the trailing tier', () => {
    expect(itemTierFromId('weapon.blade.t2')).toBe(2);
    expect(itemTierFromId('armor.leather.t1')).toBe(1);
  });
  it('defaults to 1 when there is no tier suffix', () => {
    expect(itemTierFromId('material.shadewood')).toBe(1);
  });
});
