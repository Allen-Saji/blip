/**
 * Edge-case suite for the AI summarizer, heal validation, and email escaping.
 * Run: npx tsx --test src/lib/edge-cases.test.ts
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { generateChangeSummary } from "./summarize";
import { validateHealingPreview } from "./healing/validator";
import { diffSnapshots, detectMissingFields } from "./diff/engine";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

async function withMockServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  fn: (port: number) => Promise<void>,
): Promise<void> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  try {
    await fn(port);
  } finally {
    server.close();
  }
}

const DIFF = [
  { path: "price.value", before: 189, after: 109 },
];

// ---------------------------------------------------------------------------
// Summarizer failure modes: every failure must return null, never throw.
// ---------------------------------------------------------------------------

async function summarizerEdgeCases() {
  const originalKey = process.env.CMD_API_KEY;
  const originalUrl = process.env.CMD_PROVIDER_URL;
  const originalModel = process.env.CMD_SUMMARY_MODEL;

  // 1. No API key configured -> null, no network call.
  delete process.env.CMD_API_KEY;
  const noKey = await generateChangeSummary({
    watchUrl: "https://x.com",
    watchDescription: "price",
    diff: DIFF,
  });
  assert(noKey === null, "returns null when CMD_API_KEY is unset");

  // 2. Empty diff -> null without calling the API.
  process.env.CMD_API_KEY = "test-key";
  const emptyDiff = await generateChangeSummary({
    watchUrl: "https://x.com",
    watchDescription: "price",
    diff: [],
  });
  assert(emptyDiff === null, "returns null for an empty diff");

  await withMockServer(
    (_req, res) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "bad key" } }));
    },
    async (port) => {
      process.env.CMD_PROVIDER_URL = `http://127.0.0.1:${port}/v1/chat/completions`;
      const unauthorized = await generateChangeSummary({
        watchUrl: "https://x.com",
        watchDescription: "price",
        diff: DIFF,
      });
      assert(unauthorized === null, "returns null on HTTP 401");
    },
  );

  await withMockServer(
    (_req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "upstream" } }));
    },
    async (port) => {
      process.env.CMD_PROVIDER_URL = `http://127.0.0.1:${port}/v1/chat/completions`;
      const serverError = await generateChangeSummary({
        watchUrl: "https://x.com",
        watchDescription: "price",
        diff: DIFF,
      });
      assert(serverError === null, "returns null on HTTP 500");
    },
  );

  await withMockServer(
    (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "" } }] }));
    },
    async (port) => {
      process.env.CMD_PROVIDER_URL = `http://127.0.0.1:${port}/v1/chat/completions`;
      const emptyContent = await generateChangeSummary({
        watchUrl: "https://x.com",
        watchDescription: "price",
        diff: DIFF,
      });
      assert(emptyContent === null, "returns null when the model returns empty content");
    },
  );

  await withMockServer(
    (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: '"Quoted sentence."' } }] }));
    },
    async (port) => {
      process.env.CMD_PROVIDER_URL = `http://127.0.0.1:${port}/v1/chat/completions`;
      const quoted = await generateChangeSummary({
        watchUrl: "https://x.com",
        watchDescription: "price",
        diff: DIFF,
      });
      assert(
        quoted === "Quoted sentence.",
        "strips wrapping quotes from the model response",
      );
    },
  );

  // 3. Connection refused -> null (fetch rejects).
  process.env.CMD_PROVIDER_URL = "http://127.0.0.1:9/v1/chat/completions";
  const refused = await generateChangeSummary({
    watchUrl: "https://x.com",
    watchDescription: "price",
    diff: DIFF,
  });
  assert(refused === null, "returns null when the endpoint is unreachable");

  // 4. Slow response -> null via abort timeout.
  await withMockServer(
    (_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: "late" } }] }));
      }, 60_000);
    },
    async (port) => {
      process.env.CMD_PROVIDER_URL = `http://127.0.0.1:${port}/v1/chat/completions`;
      const started = Date.now();
      const timedOut = await generateChangeSummary({
        watchUrl: "https://x.com",
        watchDescription: "price",
        diff: DIFF,
      });
      const elapsed = Date.now() - started;
      assert(timedOut === null, "returns null when the request times out");
      assert(elapsed < 25_000, "timeout fires before 25s");
    },
  );

  if (originalKey !== undefined) process.env.CMD_API_KEY = originalKey;
  else delete process.env.CMD_API_KEY;
  if (originalUrl !== undefined) process.env.CMD_PROVIDER_URL = originalUrl;
  else delete process.env.CMD_PROVIDER_URL;
  if (originalModel !== undefined) process.env.CMD_SUMMARY_MODEL = originalModel;
  else delete process.env.CMD_SUMMARY_MODEL;
}

// ---------------------------------------------------------------------------
// Heal validation edge cases.
// ---------------------------------------------------------------------------

function healEdgeCases() {
  const goodSnapshot = [
    {
      input: { url: "https://example.com/p" },
      price: { value: 189, symbol: "$", currency: "USD" },
      stock: "In stock",
    },
  ];

  // No-baseline heal: first run empty, preview has content -> accept.
  const noBaseline = validateHealingPreview(undefined, [
    { price: { value: 79, currency: "USD" }, stock: "In stock" },
  ]);
  assert(noBaseline.valid, "no-baseline heal accepts a content preview");

  // No-baseline heal: preview is empty objects -> reject.
  const noBaselineEmpty = validateHealingPreview(undefined, [{}, {}]);
  assert(!noBaselineEmpty.valid, "no-baseline heal rejects empty-object rows");

  // No-baseline heal: preview rows missing -> reject.
  const noBaselineNone = validateHealingPreview(undefined, []);
  assert(!noBaselineNone.valid, "no-baseline heal rejects an empty preview");

  // Preview with EXTRA fields the baseline lacked -> accept (site added data).
  const extraFields = validateHealingPreview(goodSnapshot, [
    { price: { value: 79, currency: "USD" }, stock: "In stock", rating: 4.7 },
  ]);
  assert(extraFields.valid, "accepts a preview that adds fields");

  // Null-valued required field in preview -> reject.
  const nullField = validateHealingPreview(goodSnapshot, [
    { price: { value: 79, currency: "USD" }, stock: null },
  ]);
  assert(!nullField.valid, "rejects a preview with a null required field");

  // Preview is a non-array -> reject.
  const nonArray = validateHealingPreview(goodSnapshot, {
    price: 1,
  } as unknown);
  assert(!nonArray.valid, "rejects a non-array preview");

  // Baseline with a null leaf (never populated) is not required in previews.
  const withNullLeaf = validateHealingPreview(
    [{ price: { value: 1, symbol: "$", currency: "USD" }, note: null }],
    [{ price: { value: 2, currency: "USD" } }],
  );
  assert(withNullLeaf.valid, "does not require a field that was null before");

  // Type check applies to nested leaves, not just top-level.
  const nestedTypeDrift = validateHealingPreview(goodSnapshot, [
    { price: "79 USD", stock: "In stock" },
  ]);
  assert(!nestedTypeDrift.valid, "rejects nested type drift (object -> string)");
}

// ---------------------------------------------------------------------------
// Diff engine corners that feed the degraded-run logic.
// ---------------------------------------------------------------------------

function diffEdgeCases() {
  // Field disappears -> hasMissingFields (degraded -> heal).
  const vanished = diffSnapshots(
    [{ price: { value: 1 }, stock: "In stock" }],
    [{ price: { value: 1 } }],
  );
  assert(vanished.hasMissingFields, "flags a vanished field as missing");

  // Field becomes empty string -> missing.
  const emptied = diffSnapshots([{ stock: "In stock" }], [{ stock: "" }]);
  assert(emptied.hasMissingFields, "flags an emptied string as missing");

  // Value changes but all fields present -> NOT missing (no heal).
  const valueOnly = diffSnapshots(
    [{ price: { value: 189 }, stock: "In stock" }],
    [{ price: { value: 109 }, stock: "In stock" }],
  );
  assert(!valueOnly.hasMissingFields, "value-only change does not trigger heal");

  // New field appears -> NOT missing.
  const added = diffSnapshots([{ price: 1 }], [{ price: 1, rating: 4.5 }]);
  assert(!added.hasMissingFields, "added fields do not trigger heal");

  assert(
    detectMissingFields([]) === false,
    "empty diff has no missing fields",
  );
}

async function main() {
  await summarizerEdgeCases();
  healEdgeCases();
  diffEdgeCases();
  console.log("\nAll edge-case tests passed.");
}

main();
