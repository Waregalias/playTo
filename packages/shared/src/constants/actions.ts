/** Maximum queued (unresolved) actions per character (GDD §7.5). */
export const ACTION_QUEUE_MAX = 3;

/** Action types available in M1. Later milestones extend this list. */
export const M1_ACTION_TYPES = ['move', 'rest'] as const;
