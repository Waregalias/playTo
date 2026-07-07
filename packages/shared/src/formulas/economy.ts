export const REPAIR_COST_PER_POINT = 1;

/** Ash-crown cost to fully repair `missingDurability` points on a tier-`itemTier` item. Pure. */
export function repairCost(missingDurability: number, itemTier: number): number {
  if (missingDurability <= 0) return 0;
  const tierFactor = 1 + 0.5 * (itemTier - 1);
  return Math.ceil(missingDurability * REPAIR_COST_PER_POINT * tierFactor);
}

/**
 * Amount credited to a community project for delivering `qty`, given the contribution
 * multiplier (Offrande ×1,4). The debited material stays `qty`; only the credit grows. Pure.
 */
export function contributionCredit(qty: number, contributionMult: number): number {
  return Math.floor(qty * contributionMult);
}

/** Market sink rate: a slice of every sale's gross vanishes from the economy (SPEC-M3 US5). */
export const MARKET_TAX_RATE = 0.05;

/** The 5 % market sink for a sale grossing `gross` écus, floored. Seller nets `gross - marketTax(gross)`. Pure. */
export function marketTax(gross: number): number {
  return Math.floor(gross * MARKET_TAX_RATE);
}

/** Tier parsed from an item id's `.t{N}` suffix (e.g. "weapon.blade.t2" → 2); defaults to 1. Pure. */
export function itemTierFromId(itemId: string): number {
  const match = /\.t(\d+)$/.exec(itemId);
  return match ? Number(match[1]) : 1;
}
