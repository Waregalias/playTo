import { and, asc, eq, lte } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { actionQueue } from '../db/schema.js';
import { resolveAction } from '../modules/actions/service.js';

const SWEEP_INTERVAL_MS = 5_000;
const BATCH_SIZE = 100;

/**
 * Background sweep for offline players (ARCHITECTURE §4.3). Shares
 * resolveAction() with the lazy path — idempotence makes the overlap safe.
 * Returns a stop function.
 */
export function startResolver(
  db: Db,
  now: () => Date = () => new Date(),
  onError: (err: unknown) => void = console.error,
): () => void {
  let running = false;

  const sweep = async () => {
    if (running) return; // previous sweep still going — skip this tick
    running = true;
    try {
      const due = await db
        .select({ id: actionQueue.id })
        .from(actionQueue)
        .where(and(eq(actionQueue.resolved, false), lte(actionQueue.endsAt, now())))
        .orderBy(asc(actionQueue.endsAt))
        .limit(BATCH_SIZE);
      for (const action of due) {
        await resolveAction(db, action.id, now());
      }
    } catch (err) {
      onError(err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
  return () => clearInterval(timer);
}
