/** Combat tuning (GDD §13) — to balance in beta. */
export const COMBAT = {
  /** Damage variance: uniform in [0.9, 1.1). */
  varianceMin: 0.9,
  varianceSpan: 0.2,
  /** Crit: chance DEX × 0.5 %, damage ×1.5. */
  critPerDex: 0.005,
  critMultiplier: 1.5,
  /** Dodge: DEX × 0.8 %. */
  dodgePerDex: 0.008,
  /** Flee: 50 % + (player DEX − foe DEX) × 3 %, clamped. */
  fleeBase: 0.5,
  fleePerDexDiff: 0.03,
  fleeMin: 0.05,
  fleeMax: 0.95,
  /** Armour/resist mitigation constant: m/(m+50). */
  mitigationScale: 50,
  /** Mist resistance: FER × 1 %. */
  mistResistPerFer: 0.01,
} as const;

/** Death of a Rekindled (GDD §2.4) — the spark wavers. */
export const DEATH_PENALTY = {
  durationHours: 2,
  statMultiplier: 0.8,
  /** Share of every stackable material stack lost on death (SPEC-M2 décision 2). */
  materialLossRatio: 0.25,
  /** HP fraction on respawn at the Ember Hall. */
  respawnHpRatio: 0.5,
} as const;

/** Combat stamina cost (GDD §8). */
export const COMBAT_STAMINA_COST = 15;

/** Durability lost by the equipped weapon and armour on each death (SPEC-M3 décision 2). */
export const DEATH_DURABILITY_LOSS = 10;
/** Equipment stats are multiplied by this when durability hits 0. */
export const BROKEN_GEAR_PENALTY = 0.5;

/** Encounter chance per terrain on move resolution, regions ≥ 1 (SPEC-M2 décision 3). */
export const ENCOUNTER_CHANCES: Record<string, number> = {
  forest: 0.35,
  ruins: 0.4,
  marsh: 0.3,
  hill: 0.2,
  ford: 0.2,
  plain: 0.15,
  shrine: 0,
  ash_road: 0,
};

/** Extra encounter chance when searching a POI. */
export const SEARCH_ENCOUNTER_BONUS = 0.1;
