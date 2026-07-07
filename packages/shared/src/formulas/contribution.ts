export interface ContributionPlan {
  /** Amount added to the project progress for this resource. */
  creditGiven: number;
  /** Raw material units actually removed from the inventory. */
  rawNeeded: number;
}

/** Clamp + Offrande maths for one contribution. Pure. `remaining` is goal − progress. */
export function planContribution(qty: number, mult: number, remaining: number): ContributionPlan {
  if (qty <= 0 || remaining <= 0) return { creditGiven: 0, rawNeeded: 0 };
  const creditWanted = Math.floor(qty * mult);
  const creditGiven = Math.min(creditWanted, remaining);
  const rawNeeded = Math.min(qty, Math.ceil(creditGiven / mult));
  return { creditGiven, rawNeeded };
}

/** Contributor XP + ash-crown reward for a given credited amount. Pure. */
export function contributionReward(credit: number): { xp: number; ashCrowns: number } {
  return { xp: credit, ashCrowns: Math.floor(credit / 5) };
}
