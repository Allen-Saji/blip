type JsonObject = Record<string, unknown>;

export type HealingValidation = {
  valid: boolean;
  reason: string | null;
  requiredPaths: string[];
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return true;
}

function valueKind(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (isObject(value)) return "object";
  return typeof value;
}

function collectLeafPaths(value: unknown, path = ""): string[] {
  if (!isObject(value)) {
    return path ? [path] : [];
  }

  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (isObject(child)) {
      paths.push(...collectLeafPaths(child, childPath));
    } else {
      paths.push(childPath);
    }
  }
  return paths;
}

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!isObject(current)) return undefined;
    return current[key];
  }, value);
}

function firstRow(snapshot: unknown): unknown {
  return Array.isArray(snapshot) ? snapshot[0] : undefined;
}

/**
 * Paths a real Scraper Studio healing preview never carries, even when the
 * heal is correct: the trigger's `input` echo and currency `symbol` fields
 * (previews return `{value, currency}` only). Verified live 2026-08-20/21;
 * see BRIGHTDATA-API-CONTRACT.md gotchas.
 */
function isPreviewExempt(path: string): boolean {
  return (
    path === "input" ||
    path.startsWith("input.") ||
    path === "symbol" ||
    path.endsWith(".symbol")
  );
}

/**
 * Check whether a Scraper Studio healing preview preserves the last valid
 * output contract before the caller promotes it to the live collector.
 */
export function validateHealingPreview(
  previousSnapshot: unknown,
  preview: unknown,
): HealingValidation {
  const previousRow = firstRow(previousSnapshot);
  // Only fields that were actually populated in the last good snapshot are
  // required; a leaf that was null/empty before was never extracted.
  const requiredPaths = collectLeafPaths(previousRow).filter(
    (path) => !isPreviewExempt(path) && isPresent(getPath(previousRow, path)),
  );
  const previewRows = Array.isArray(preview) ? preview : [];

  if (previewRows.length === 0) {
    return {
      valid: false,
      reason: "preview returned no rows",
      requiredPaths,
    };
  }

  if (requiredPaths.length === 0) {
    // No prior good snapshot to compare against (first run came back empty or
    // degraded). The refactor is the only recovery path, so accept any
    // preview that returned a row with content.
    const hasContent = previewRows.some(
      (row) => isObject(row) && Object.keys(row).length > 0,
    );
    return {
      valid: hasContent,
      reason: hasContent ? null : "preview rows are empty objects",
      requiredPaths,
    };
  }

  const missingPaths = requiredPaths.filter((path) =>
    previewRows.some((row) => !isPresent(getPath(row, path))),
  );
  if (missingPaths.length > 0) {
    return {
      valid: false,
      reason: `preview is missing required fields: ${missingPaths.join(", ")}`,
      requiredPaths,
    };
  }

  const typeMismatches = requiredPaths.filter((path) => {
    const before = getPath(previousRow, path);
    const after = getPath(previewRows[0], path);
    return valueKind(before) !== valueKind(after);
  });
  if (typeMismatches.length > 0) {
    return {
      valid: false,
      reason: `preview changed field types: ${typeMismatches.join(", ")}`,
      requiredPaths,
    };
  }

  return { valid: true, reason: null, requiredPaths };
}
