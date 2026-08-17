import { db } from "../../db";
import { watches, jobs } from "../../db/schema";
import { and, eq, or } from "drizzle-orm";

const CADENCE_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Find watches whose cadence has elapsed since lastRunAt and enqueue a run job
 * for each, unless one is already queued/running.
 */
export async function schedulerTick(): Promise<number> {
  const now = new Date();
  const due = await db
    .select()
    .from(watches)
    .where(eq(watches.status, "active"));

  let enqueued = 0;
  for (const watch of due) {
    const cadenceMs = CADENCE_MS[watch.cadence] ?? CADENCE_MS.daily;
    const lastRun = watch.lastRunAt?.getTime() ?? 0;
    const dueAt = lastRun + cadenceMs;

    if (Date.now() < dueAt) continue;

    // Skip if there's already a queued/running run or heal for this watch.
    const activeJobs = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          eq(jobs.watchId, watch.id),
          or(eq(jobs.status, "queued"), eq(jobs.status, "running")),
          or(eq(jobs.type, "run"), eq(jobs.type, "heal")),
        ),
      )
      .limit(1);

    if (activeJobs.length > 0) continue;

    await db.insert(jobs).values({
      type: "run",
      watchId: watch.id,
      status: "queued",
      nextRunAt: now,
    });
    enqueued++;
  }

  return enqueued;
}

