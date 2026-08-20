import type { DiffResult } from "../diff/engine";

export type ChangeClassification =
  | "meaningful_change"
  | "unmatched_change"
  | "extraction_drift";

type NumericRule = {
  kind: "numeric";
  field: string;
  operator: "below" | "above";
  threshold: number;
};

type ContainsRule = {
  kind: "contains";
  field: string;
  phrase: string;
};

type ParsedRule = NumericRule | ContainsRule | { kind: "any" };

export type ChangeClassificationResult = {
  classification: ChangeClassification;
  matched: boolean;
  reason: string;
};

const STOP_WORDS = new Set([
  "alert", "back", "becomes", "below", "change", "changes", "comes",
  "drop", "drops", "fall", "falls", "from", "get", "gets", "greater",
  "in", "is", "less", "me", "notify", "of", "on", "over", "the", "than",
  "this", "to", "under", "value", "when", "with", "you",
]);

function extractField(prefix: string): string {
  const tokens = prefix.toLowerCase().match(/[a-z][a-z0-9_.-]*/g) ?? [];
  return tokens.find((token) => !STOP_WORDS.has(token)) ?? "";
}

export function parseAlertRule(input: string | null | undefined): ParsedRule {
  const rule = input?.trim().toLowerCase() ?? "";
  if (!rule || rule === "any change" || rule === "any meaningful change") {
    return { kind: "any" };
  }

  const numericMatch = rule.match(
    /^(.*?)(below|under|less than|above|over|greater than|<=|>=)\s*\$?([0-9]+(?:\.[0-9]+)?)/,
  );
  if (numericMatch) {
    const [, prefix, operator, threshold] = numericMatch;
    return {
      kind: "numeric",
      field: extractField(prefix),
      operator: /below|under|less than|<=/.test(operator) ? "below" : "above",
      threshold: Number(threshold),
    };
  }

  const containsMatch = rule.match(
    /^(.*?)(?:contains?|mentions?|includes?)\s+["']?([^"']+?)["']?\s*$/,
  );
  if (containsMatch) {
    return {
      kind: "contains",
      field: extractField(containsMatch[1]),
      phrase: containsMatch[2].trim(),
    };
  }

  if (/back in stock|in stock|available/.test(rule)) {
    return { kind: "contains", field: "stock", phrase: "in stock" };
  }

  return { kind: "any" };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (isObject(value)) return numericValue(value.value);
  if (typeof value === "string") {
    const match = value.replace(/,/g, "").match(/-?[0-9]+(?:\.[0-9]+)?/);
    return match ? Number(match[0]) : null;
  }
  return null;
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value.toLowerCase();
  if (isObject(value)) return Object.values(value).map(textValue).join(" ");
  return String(value ?? "").toLowerCase();
}

function fieldMatches(path: string, field: string): boolean {
  return !field || path.toLowerCase().split(/[.[\]]/).includes(field);
}

function evaluateRule(
  diff: DiffResult["diff"],
  rule: ParsedRule,
): { matched: boolean; reason: string } {
  if (rule.kind === "any") {
    return { matched: diff.length > 0, reason: "any changed field matches" };
  }

  const candidate = diff.find((entry) => fieldMatches(entry.path, rule.field));
  if (!candidate) {
    return {
      matched: false,
      reason: `no changed field matched ${rule.field || "the alert rule"}`,
    };
  }

  if (rule.kind === "numeric") {
    const after = numericValue(candidate.after);
    if (after === null) {
      return { matched: false, reason: `${candidate.path} is not numeric` };
    }
    const matched =
      rule.operator === "below"
        ? after < rule.threshold
        : after > rule.threshold;
    return {
      matched,
      reason: matched
        ? `${candidate.path} crossed the ${rule.operator} ${rule.threshold} rule`
        : `${candidate.path} did not cross the ${rule.operator} ${rule.threshold} rule`,
    };
  }

  const after = textValue(candidate.after);
  const before = textValue(candidate.before);
  const matched = after.includes(rule.phrase) && !before.includes(rule.phrase);
  return {
    matched,
    reason: matched
      ? `${candidate.path} now contains ${rule.phrase}`
      : `${candidate.path} did not newly contain ${rule.phrase}`,
  };
}

export function classifyChange(
  result: DiffResult,
  alertRule: string | null | undefined,
): ChangeClassificationResult {
  if (result.hasMissingFields) {
    return {
      classification: "extraction_drift",
      matched: false,
      reason: "a previously populated field became empty or disappeared",
    };
  }

  const evaluation = evaluateRule(result.diff, parseAlertRule(alertRule));
  return {
    classification: evaluation.matched
      ? "meaningful_change"
      : "unmatched_change",
    matched: evaluation.matched,
    reason: evaluation.reason,
  };
}
