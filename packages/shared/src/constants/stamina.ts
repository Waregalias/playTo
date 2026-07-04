export const STAMINA_MAX = 100;

/** Passive regeneration: 1 point every 6 minutes (GDD §7.4). */
export const STAMINA_REGEN_MINUTES_PER_POINT = 6;

/** Passive regen multiplier while resting on a shrine hex (GDD §7.4). */
export const SHRINE_REGEN_MULTIPLIER = 1.5;

/** Passive regen multiplier while inside the bastion, region 0 (GDD §7.4). */
export const BASTION_REGEN_MULTIPLIER = 2;

/** Rest action on a shrine: 30 min for +75 stamina, capped (GDD §8, US5). */
export const REST_ACTION = {
  durationMinutes: 30,
  staminaGain: 75,
} as const;
