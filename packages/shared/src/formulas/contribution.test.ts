import { describe, it, expect } from 'vitest';
import { planContribution, contributionReward } from './contribution.js';

describe('planContribution', () => {
  it('debits and credits 1:1 without a multiplier', () => {
    expect(planContribution(50, 1, 5000)).toEqual({ creditGiven: 50, rawNeeded: 50 });
  });
  it('clamps the credit to the remaining goal and debits only what is needed', () => {
    expect(planContribution(100, 1, 10)).toEqual({ creditGiven: 10, rawNeeded: 10 });
  });
  it('applies the Offrande multiplier to the credit, not the debit', () => {
    expect(planContribution(100, 1.4, 5000)).toEqual({ creditGiven: 140, rawNeeded: 100 });
  });
  it('with a multiplier near completion, debits fewer raw units', () => {
    expect(planContribution(100, 1.4, 50)).toEqual({ creditGiven: 50, rawNeeded: 36 });
  });
  it('is a no-op when nothing remains or qty is zero', () => {
    expect(planContribution(100, 1.4, 0)).toEqual({ creditGiven: 0, rawNeeded: 0 });
    expect(planContribution(0, 1, 100)).toEqual({ creditGiven: 0, rawNeeded: 0 });
  });
});

describe('contributionReward', () => {
  it('grants 1 XP per credit and 1 écu per 5 credit', () => {
    expect(contributionReward(50)).toEqual({ xp: 50, ashCrowns: 10 });
    expect(contributionReward(3)).toEqual({ xp: 3, ashCrowns: 0 });
  });
});
