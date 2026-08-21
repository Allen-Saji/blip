import { db } from "../../db";
import { jobs, watches, runs, changes } from "../../db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import * as brightdata from "../brightdata/client";
import { diffSnapshots } from "../diff/engine";
import { classifyChange } from "../alerts/rules";
import { validateHealingPreview } from "../healing/validator";
import { canRetry, retryDelayMs } from "./retry";

const POLL_INTERVAL_MS = 5000;
const CREATE_TIMEOUT_MS = 25 * 60 * 1000;
const HEAL_TIMEOUT_MS = 15 * 60 * 1000;
const RUN_TIMEOUT_MS = 5 * 60 * 1000;

type JobRow = typeof jobs.$inferSelect;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Claim the next due job with FOR UPDATE SKIP LOCKED. Returns null if none.
 * Sets the row to running and records the lock time.
 */
async function claimNextJob(): Promise<JobRow | null> {
  return db.transaction(async (tx) => {
    const claimed = await tx
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, "queued"),
          sql`${jobs.nextRunAt} <= now()`,
        ),
      )
      .orderBy(jobs.nextRunAt)
      .limit(1)
      .for("update", { skipLocked: true });

    if (claimed.length === 0) return null;

    const job = claimed[0];
    const updated = await tx
      .update(jobs)
      .set({
        status: "running",
        lockedAt: new Date(),
        attempts: job.attempts + 1,
      })
      .where(eq(jobs.id, job.id))
      .returning();

    return updated[0] ?? null;
  });
}

function completeJob(jobId: string) {
  return db
    .update(jobs)
    .set({ status: "done", lockedAt: null, finishedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

function failJob(jobId: string, error: string) {
  return db
    .update(jobs)
    .set({ status: "failed", lockedAt: null, error, finishedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

async function setWatchState(
  watchId: string,
  status: "creating" | "active" | "healing" | "error",
  lastError: string | null = null,
): Promise<void> {
  await db
    .update(watches)
    .set({ status, lastError })
    .where(eq(watches.id, watchId));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof brightdata.BrightDataError) {
    return (
      error.status === 408 ||
      error.status === 425 ||
      error.status === 429 ||
      error.status >= 500
    );
  }
  return true;
}

async function withTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt >= 3 || !isRetryableError(error)) throw error;
      const delay = 1_000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
      await sleep(delay);
    }
  }
}

async function retryJob(job: JobRow, error: string): Promise<boolean> {
  if (!canRetry(job.attempts)) return false;
  const delay = retryDelayMs(job.attempts) + Math.floor(Math.random() * 1_000);
  await db
    .update(jobs)
    .set({
      status: "queued",
      lockedAt: null,
      error,
      nextRunAt: new Date(Date.now() + delay),
    })
    .where(eq(jobs.id, job.id));
  console.warn(
    `Job ${job.id} failed on attempt ${job.attempts}; retrying in ${delay}ms`,
  );
  return true;
}

async function pollUntil<T>(
  fn: () => Promise<T>,
  isDone: (v: T) => boolean,
  timeoutMs: number,
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await withTransientRetry(fn);
    if (isDone(value)) return value;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`poll timed out after ${timeoutMs}ms`);
}

/**
 * Enqueue a job. Idempotent by caller convention: callers check for existing
 * queued/running jobs of the same (watchId, type) before enqueuing.
 */
export async function enqueueJob(
  type: "create" | "run" | "heal",
  watchId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(jobs).values({
    type,
    watchId,
    payload,
    status: "queued",
    nextRunAt: new Date(),
  });
}

/**
 * CREATE handler: build the collector from the watch's plain-language description.
 */
async function handleCreate(job: JobRow) {
  if (!job.watchId) throw new Error("create job missing watchId");
  const watch = await db
    .select()
    .from(watches)
    .where(eq(watches.id, job.watchId))
    .limit(1);
  if (watch.length === 0) throw new Error(`watch ${job.watchId} not found`);
  const w = watch[0];
  await setWatchState(w.id, "creating");

  const collector = await brightdata.createCollector(`blip-${w.id}`);
  await brightdata.createCollectorCode(collector.id, w.description, w.url);

  await pollUntil(
    () => brightdata.getAiJobProgress(collector.id),
    (p) => p.status === "done",
    CREATE_TIMEOUT_MS,
  );

  await db
    .update(watches)
    .set({ collectorId: collector.id, status: "active", lastError: null })
    .where(eq(watches.id, w.id));

  await enqueueJob("run", w.id);
}

/**
 * RUN handler: trigger the collector, poll for the dataset, diff against the
 * previous snapshot, and route empty results to heal.
 */
async function handleRun(job: JobRow) {
  if (!job.watchId) throw new Error("run job missing watchId");
  const watch = await db
    .select()
    .from(watches)
    .where(eq(watches.id, job.watchId))
    .limit(1);
  if (watch.length === 0) throw new Error(`watch ${job.watchId} not found`);
  const w = watch[0];
  if (!w.collectorId) throw new Error(`watch ${w.id} has no collectorId`);

  const run = await db
    .insert(runs)
    .values({ watchId: w.id, status: "running", startedAt: new Date() })
    .returning();

  const trigger = await brightdata.triggerCollection(w.collectorId, [
    { url: w.url },
  ]);

  await db
    .update(runs)
    .set({ snapshotId: trigger.collection_id })
    .where(eq(runs.id, run[0].id));

  const dataset = await pollUntil(
    () => brightdata.getDataset(trigger.collection_id),
    (d) => Array.isArray(d),
    RUN_TIMEOUT_MS,
  );

  const afterJson = dataset as unknown[];
  const isEmpty = afterJson.length === 0;

  const prevRun = await db
    .select()
    .from(runs)
    .where(and(eq(runs.watchId, w.id), eq(runs.status, "succeeded")))
    .orderBy(desc(runs.finishedAt))
    .limit(1);

  const beforeJson = prevRun[0]?.rawJson ?? null;

  await db
    .update(runs)
    .set({
      status: isEmpty ? "empty" : "succeeded",
      rawJson: afterJson as never,
      finishedAt: new Date(),
    })
    .where(eq(runs.id, run[0].id));

  await db
    .update(watches)
    .set({ lastRunAt: new Date() })
    .where(eq(watches.id, w.id));

  if (isEmpty) {
    await setWatchState(w.id, "healing");
    await enqueueJob("heal", w.id, {
      reason: "empty dataset",
      description: w.description,
    });
    return;
  }

  // Diff against previous snapshot. Only create a change row if something
  // semantically changed.
  if (beforeJson) {
    const result = diffSnapshots(beforeJson, afterJson);
    const classification = classifyChange(result, w.alertRule);
    if (result.diff.length > 0) {
      // AI summary is best-effort: falls back to the mechanical summary.
      const { generateChangeSummary } = await import("../summarize");
      const aiSummary = await generateChangeSummary({
        watchUrl: w.url,
        watchDescription: w.description,
        diff: result.diff,
      });

      const inserted = await db
        .insert(changes)
        .values({
          watchId: w.id,
          runId: run[0].id,
          beforeJson: beforeJson as never,
          afterJson: afterJson as never,
          summary: result.summary,
          aiSummary: aiSummary ?? null,
          classification: classification.classification,
        })
        .returning();

      // Email-on-change is best-effort: a notification failure must not fail
      // the run (the change row is already durable).
      if (w.email && classification.matched) {
        try {
          const { sendChangeEmail } = await import("../email");
          await sendChangeEmail({
            to: w.email,
            watchUrl: w.url,
            watchDescription: w.description,
            summary: result.summary,
            aiSummary,
          });
          await db
            .update(changes)
            .set({ notifiedAt: new Date() })
            .where(eq(changes.id, inserted[0].id));
        } catch (err) {
          console.error(
            `email for watch ${w.id} failed:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
    if (result.hasMissingFields) {
      await setWatchState(w.id, "healing");
      await enqueueJob("heal", w.id, {
        reason: "missing fields detected",
        description: w.description,
      });
    } else {
      await setWatchState(w.id, "active");
    }
  } else {
    await setWatchState(w.id, "active");
  }
}

/**
 * HEAL handler: refactor the collector from the watch description, approve,
 * and re-run.
 */
async function handleHeal(job: JobRow) {
  if (!job.watchId) throw new Error("heal job missing watchId");
  const watch = await db
    .select()
    .from(watches)
    .where(eq(watches.id, job.watchId))
    .limit(1);
  if (watch.length === 0) throw new Error(`watch ${job.watchId} not found`);
  const w = watch[0];
  await setWatchState(w.id, "healing");
  if (!w.collectorId) throw new Error(`watch ${w.id} has no collectorId`);
  const collectorId = w.collectorId;

  const prompt = buildHealPrompt(w.description);
  await brightdata.triggerSelfHeal(collectorId, prompt);

  const previousRun = await db
    .select({ rawJson: runs.rawJson })
    .from(runs)
    .where(and(eq(runs.watchId, w.id), eq(runs.status, "succeeded")))
    .orderBy(desc(runs.finishedAt))
    .limit(1);

  const progress = await pollUntil(
    () => brightdata.getSelfHealProgress(collectorId),
    (p) => p.status === "pending_answer" || p.status === "done",
    HEAL_TIMEOUT_MS,
  );

  if (progress.status === "pending_answer") {
    const validation = validateHealingPreview(
      previousRun[0]?.rawJson,
      progress.preview_result,
    );
    if (!validation.valid) {
      await brightdata.resumeSelfHeal(collectorId, false).catch(() => undefined);
      throw new Error(`self-heal preview rejected: ${validation.reason}`);
    }

    await brightdata.resumeSelfHeal(collectorId, true);
    // Wait for the approved template to be persisted before re-running.
    await pollUntil(
      () => brightdata.getSelfHealProgress(collectorId),
      (p) => p.status === "done",
      HEAL_TIMEOUT_MS,
    );
  }

  await enqueueJob("run", w.id);
}

function buildHealPrompt(description: string): string {
  return `The extraction returned empty or missing fields since the site changed. Re-capture the fields described as: ${description}`;
}

export async function workerTick(): Promise<number> {
  const job = await claimNextJob();
  if (!job) return 0;

  try {
    switch (job.type) {
      case "create":
        await handleCreate(job);
        break;
      case "run":
        await handleRun(job);
        break;
      case "heal":
        await handleHeal(job);
        break;
      default:
        throw new Error(`unknown job type ${job.type}`);
    }
    await completeJob(job.id);
    return 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!(await retryJob(job, message))) {
      await failJob(job.id, message);
      if (job.watchId) {
        await setWatchState(job.watchId, "error", message);
      }
    }
    return 1;
  }
}

export async function workerLoop(): Promise<void> {
  // Run forever, claiming jobs as they come due.
  let lastSchedulerTick = 0;
  for (;;) {
    const processed = await workerTick();

    // Run the scheduler every 60s to enqueue due watches.
    if (Date.now() - lastSchedulerTick > 60_000) {
      const { schedulerTick } = await import("./scheduler");
      const enqueued = await schedulerTick();
      if (enqueued > 0) {
        console.log(`Scheduler enqueued ${enqueued} run job(s)`);
      }
      lastSchedulerTick = Date.now();
    }

    if (processed === 0) {
      await sleep(POLL_INTERVAL_MS);
    }
  }
}
