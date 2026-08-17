/**
 * Diff engine: compares two snapshots (before/after) and produces a
 * field-by-field delta plus a mechanical summary.
 *
 * Rules:
 *  - Deep-compares nested objects (the Bright Data "price" field is an object).
 *  - Treats a field that was present before and now null/missing as a REAL
 *    change (potential self-heal trigger upstream).
 *  - Produces a mechanical summary with no LLM dependency.
 */

export type DiffEntry = {
  path: string;
  before: unknown;
  after: unknown;
};

export type DiffResult = {
  diff: DiffEntry[];
  summary: string;
  // True when fields that existed before went missing/null — the "site moved"
  // signal that should route to self-heal.
  hasMissingFields: boolean;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Deep diff two JSON values. Returns a flat list of changed paths.
 */
export function deepDiff(
  before: unknown,
  after: unknown,
  path = "",
): DiffEntry[] {
  // Both primitives (or null) — compare directly.
  if (!isObject(before) && !isArray(before)) {
    if (before !== after) {
      return [{ path: path || "(root)", before, after }];
    }
    return [];
  }

  if (!isObject(after) && !isArray(after)) {
    // before was object/array, after is primitive/null.
    return [{ path: path || "(root)", before, after }];
  }

  // Both are objects or both arrays. Handle arrays by index.
  if (isArray(before) && isArray(after)) {
    const entries: DiffEntry[] = [];
    const maxLen = Math.max(before.length, after.length);
    for (let i = 0; i < maxLen; i++) {
      entries.push(...deepDiff(before[i], after[i], `${path}[${i}]`));
    }
    return entries;
  }

  if (isObject(before) && isObject(after)) {
    const entries: DiffEntry[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key;
      const beforeVal = before[key];
      const afterVal = after[key];

      if (!(key in before)) {
        entries.push({ path: childPath, before: undefined, after: afterVal });
        continue;
      }
      if (!(key in after)) {
        entries.push({ path: childPath, before: beforeVal, after: undefined });
        continue;
      }
      entries.push(...deepDiff(beforeVal, afterVal, childPath));
    }
    return entries;
  }

  // Type mismatch (object vs array) — treat as a change at this path.
  return [{ path: path || "(root)", before, after }];
}

function formatValue(value: unknown): string {
  if (value === undefined) return "∅ (missing)";
  if (value === null) return "null";
  if (isObject(value) || isArray(value)) return JSON.stringify(value);
  return String(value);
}

/**
 * Detect missing fields: a field that existed (non-null/undefined) before is
 * now null or undefined. This is the "site moved" signal.
 */
export function detectMissingFields(diff: DiffEntry[]): boolean {
  return diff.some((entry) => {
    const beforeMissing =
      entry.before === undefined ||
      entry.before === null ||
      entry.before === "";
    const afterMissing =
      entry.after === undefined || entry.after === null || entry.after === "";
    return !beforeMissing && afterMissing;
  });
}

export function diffSnapshots(before: unknown, after: unknown): DiffResult {
  const diff = deepDiff(before, after);
  const hasMissingFields = detectMissingFields(diff);

  let summary: string;
  if (diff.length === 0) {
    summary = "No changes detected.";
  } else {
    const parts = diff.map(
      (entry) =>
        `${entry.path}: ${formatValue(entry.before)} → ${formatValue(entry.after)}`,
    );
    summary = `${diff.length} field${diff.length === 1 ? "" : "s"} changed: ${parts.join(", ")}`;
  }

  return { diff, summary, hasMissingFields };
}
