import {
  STAMINA_MAX,
  STAMINA_REGEN_MINUTES_PER_POINT,
  SHRINE_REGEN_MULTIPLIER,
  BASTION_REGEN_MULTIPLIER,
} from '../constants/stamina.js';

export interface StaminaState {
  /** Last persisted stamina value. */
  stamina: number;
  /** Timestamp at which `stamina` was persisted. */
  staminaUpdatedAt: Date;
}

export interface ComputedStamina {
  stamina: number;
  /**
   * Timestamp to persist alongside the new value so that the fractional
   * remainder of the current regen interval is never lost. Equal to `now`
   * once the cap is reached.
   */
  staminaUpdatedAt: Date;
}

export type RegenContext = 'field' | 'shrine' | 'bastion';

export function regenMultiplier(context: RegenContext): number {
  switch (context) {
    case 'bastion':
      return BASTION_REGEN_MULTIPLIER;
    case 'shrine':
      return SHRINE_REGEN_MULTIPLIER;
    case 'field':
      return 1;
  }
}

/**
 * Recomputes stamina from its persisted (value, updatedAt) pair.
 * Pure — `now` is always injected (SPEC-M1: never `new Date()` inline).
 */
export function computeStamina(
  state: StaminaState,
  now: Date,
  context: RegenContext = 'field',
): ComputedStamina {
  const intervalMs =
    (STAMINA_REGEN_MINUTES_PER_POINT * 60_000) / regenMultiplier(context);
  const elapsedMs = now.getTime() - state.staminaUpdatedAt.getTime();

  if (elapsedMs <= 0 || state.stamina >= STAMINA_MAX) {
    return {
      stamina: Math.min(state.stamina, STAMINA_MAX),
      staminaUpdatedAt: state.stamina >= STAMINA_MAX ? now : state.staminaUpdatedAt,
    };
  }

  const pointsGained = Math.floor(elapsedMs / intervalMs);
  const stamina = Math.min(STAMINA_MAX, state.stamina + pointsGained);

  const staminaUpdatedAt =
    stamina >= STAMINA_MAX
      ? now
      : new Date(state.staminaUpdatedAt.getTime() + pointsGained * intervalMs);

  return { stamina, staminaUpdatedAt };
}
