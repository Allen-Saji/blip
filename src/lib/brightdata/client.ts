/**
 * Bright Data Scraper Studio client.
 *
 * Wraps two APIs:
 *  - Collection API (/dca/*)  : run an existing collector, fetch results.
 *  - AI Flow API              : create a scraper from a description, self-heal it.
 *
 * All operations are async. This module exposes the raw HTTP calls; the job
 * worker owns the polling/state-machine on top of these.
 */

const BASE_URL = "https://api.brightdata.com";

export class BrightDataError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "BrightDataError";
    this.status = status;
    this.body = body;
  }
}

export type CollectorId = string; // c_*
export type SnapshotId = string; // j_* (a.k.a. collection_id)

export interface CreateCollectorResponse {
  id: CollectorId;
  name: string;
  active: boolean;
  created: string;
}

export interface AiJobProgress {
  step: string;
  completed_steps: string[];
  status: "done" | "running" | "pending_answer" | "failed" | "error" | "cancelled" | (string & {});
}

export interface TriggerResponse {
  collection_id: SnapshotId;
}

export interface HealProgress {
  status: "done" | "running" | "pending_answer" | "failed" | "error" | "cancelled" | (string & {});
  preview_result?: unknown;
  next_step?: string;
  id?: string;
  step?: string;
  completed_steps?: string[];
  diff?: unknown;
  success?: boolean;
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
}

async function request<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  if (!token) {
    throw new BrightDataError(
      "BRIGHTDATA_API_TOKEN is not set",
      401,
      null,
    );
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    throw new BrightDataError(
      `Bright Data API ${res.status}: ${text.slice(0, 200)}`,
      res.status,
      body,
    );
  }

  return body as T;
}

/**
 * Create a scraper entity. Returns a collector ID (c_*). The scraper is NOT
 * yet generated; call `createCollectorCode` next, then poll `getAiJobProgress`.
 */
export function createCollector(name: string): Promise<CreateCollectorResponse> {
  return request<CreateCollectorResponse>("/dca/collector", {
    method: "POST",
    body: {
      name,
      deliver: {
        type: "webhook",
        endpoint: "https://example.com/webhook",
        filename: { template: "data", extension: "json" },
      },
    },
  });
}

/**
 * Start the AI generation job (schema + code) for a collector, from a
 * plain-language description of what to extract.
 */
export function createCollectorCode(
  collectorId: CollectorId,
  description: string,
  url: string,
): Promise<unknown> {
  return request(`/dca/collectors/${collectorId}/automate_template`, {
    method: "POST",
    body: {
      description,
      urls: [url],
    },
  });
}

/**
 * Poll the AI generation job until status is "done".
 */
export function getAiJobProgress(
  collectorId: CollectorId,
): Promise<AiJobProgress> {
  return request<AiJobProgress>(
    `/dca/collectors/${collectorId}/automate_template/progress`,
  );
}

/**
 * Run an existing collector on a list of inputs. Returns a snapshot ID (j_*).
 * Poll `getDataset` until it returns a JSON array.
 */
export function triggerCollection(
  collectorId: CollectorId,
  inputs: Array<{ url: string }>,
  queueNext = 1,
): Promise<TriggerResponse> {
  return request<TriggerResponse>(
    `/dca/trigger?collector=${collectorId}&queue_next=${queueNext}`,
    {
      method: "POST",
      body: inputs,
    },
  );
}

/**
 * Fetch the dataset for a snapshot. Returns a status object while building,
 * or a JSON array when ready.
 */
export function getDataset(
  snapshotId: SnapshotId,
): Promise<{ status: string } | unknown[]> {
  return request<{ status: string } | unknown[]>(
    `/dca/dataset?id=${snapshotId}`,
  );
}

/**
 * Start a self-healing refactor job on an existing collector.
 * The prompt describes what broke in plain language.
 */
export function triggerSelfHeal(
  collectorId: CollectorId,
  prompt: string,
): Promise<unknown> {
  return request(`/dca/collectors/${collectorId}/refactor_template`, {
    method: "POST",
    body: { prompt, custom_input: [] },
  });
}

/**
 * Poll the self-healing job progress. Stops at "pending_answer" (approval gate)
 * or reaches "done".
 */
export function getSelfHealProgress(
  collectorId: CollectorId,
): Promise<HealProgress> {
  return request<HealProgress>(
    `/dca/collectors/${collectorId}/refactor_template/progress`,
  );
}

/**
 * Approve (or reject) a self-healing job that is awaiting approval.
 */
export function resumeSelfHeal(
  collectorId: CollectorId,
  approve: boolean,
): Promise<unknown> {
  return request(`/dca/collectors/${collectorId}/resume_automation_job`, {
    method: "POST",
    body: { message: approve },
  });
}
