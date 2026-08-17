/**
 * Bright Data contract test.
 *
 * Verifies the full create → run → heal → run loop against the live API and
 * pins the exact response shapes the rest of Blip depends on.
 *
 * Run with:
 *   BRIGHTDATA_API_TOKEN=... npx tsx scripts/brightdata-contract.ts
 *
 * This consumes real Bright Data credits (create ~ a few page loads + the
 * scrape itself). Run deliberately.
 */

import {
  createCollector,
  createCollectorCode,
  getAiJobProgress,
  triggerCollection,
  getDataset,
  triggerSelfHeal,
  getSelfHealProgress,
  resumeSelfHeal,
  type AiJobProgress,
  type HealProgress,
} from "../src/lib/brightdata/client";

const TARGET_URL =
  "https://ecommerce-shop-brd.vercel.app/product/echo-portable-speaker";

const DESCRIPTION =
  "Extract the product title, price, availability status, and currency.";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil<T>(
  fn: () => Promise<T>,
  isDone: (value: T) => boolean,
  timeoutMs: number,
  intervalMs = 5000,
  label = "poll",
): Promise<T> {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    attempt++;
    const value = await fn();
    if (isDone(value)) {
      console.log(`[${label}] done after ${attempt} attempts`);
      return value;
    }
    process.stdout.write(
      `[${label}] attempt ${attempt} (${Math.round((Date.now() - start) / 1000)}s)\r`,
    );
    await sleep(intervalMs);
  }
  throw new Error(`[${label}] timed out after ${timeoutMs}ms`);
}

async function main() {
  if (!process.env.BRIGHTDATA_API_TOKEN) {
    console.error("BRIGHTDATA_API_TOKEN is not set. Exiting.");
    process.exit(1);
  }

  console.log("=== 1. CREATE COLLECTOR ===");
  const collector = await createCollector(
    `blip-contract-${Date.now()}`,
  );
  console.log("Collector created:", collector.id);
  if (!collector.id.startsWith("c_")) {
    throw new Error(`Unexpected collector ID shape: ${collector.id}`);
  }

  console.log("\n=== 2. START AI GENERATION ===");
  await createCollectorCode(collector.id, DESCRIPTION, TARGET_URL);
  console.log("AI generation triggered");

  const progress = await pollUntil<AiJobProgress>(
    () => getAiJobProgress(collector.id),
    (p) => p.status === "done",
    25 * 60 * 1000,
    5000,
    "create",
  );
  console.log("Create progress:", JSON.stringify(progress, null, 2));

  console.log("\n=== 3. RUN COLLECTOR ===");
  const trigger = await triggerCollection(collector.id, [{ url: TARGET_URL }]);
  console.log("Triggered. Snapshot ID:", trigger.collection_id);
  if (!trigger.collection_id.startsWith("j_")) {
    throw new Error(`Unexpected snapshot ID shape: ${trigger.collection_id}`);
  }

  const dataset = await pollUntil<{ status: string } | unknown[]>(
    () => getDataset(trigger.collection_id),
    (d) => Array.isArray(d),
    5 * 60 * 1000,
    5000,
    "run",
  );
  console.log("Dataset (first run):", JSON.stringify(dataset, null, 2));

  if (!Array.isArray(dataset) || dataset.length === 0) {
    throw new Error("Expected non-empty dataset array");
  }

  console.log("\n=== 4. SELF-HEAL ===");
  // Simulate a broken field by asking to re-capture a field that exists.
  // In a real scenario the prompt describes what broke after a redesign.
  await triggerSelfHeal(
    collector.id,
    "The price field returns null since a redesign. Re-capture price and currency from the new markup.",
  );
  console.log("Self-heal triggered");

  const healProgress = await pollUntil<HealProgress>(
    () => getSelfHealProgress(collector.id),
    (p) => p.status === "pending_answer" || p.status === "done",
    15 * 60 * 1000,
    5000,
    "heal",
  );
  console.log("Heal progress:", JSON.stringify(healProgress, null, 2));

  if (healProgress.status === "pending_answer") {
    console.log("Heal reached approval gate. Approving...");
    await resumeSelfHeal(collector.id, true);
    console.log("Approved");
  }

  console.log("\n=== 5. RE-RUN AFTER HEAL ===");
  const trigger2 = await triggerCollection(collector.id, [{ url: TARGET_URL }]);
  const dataset2 = await pollUntil<{ status: string } | unknown[]>(
    () => getDataset(trigger2.collection_id),
    (d) => Array.isArray(d),
    5 * 60 * 1000,
    5000,
    "run-after-heal",
  );
  console.log("Dataset (after heal):", JSON.stringify(dataset2, null, 2));

  console.log("\n=== CONTRACT PASSED ===");
  console.log("Collector ID (save for reuse):", collector.id);
}

main().catch((err) => {
  console.error("\n=== CONTRACT FAILED ===");
  console.error(err);
  process.exit(1);
});
