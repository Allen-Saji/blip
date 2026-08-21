import { validateHealingPreview } from "./validator";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

// Last good full run: includes the input echo and price.symbol, which real
// healing previews never carry.
const previous = [
  {
    input: { url: "https://example.com/product" },
    title: "Aurora X9",
    price: { value: 189, symbol: "$", currency: "USD" },
    stock: "In stock",
  },
];

// Real preview shape observed live: no input echo, no price.symbol.
const validPreview = [
  {
    title: "Aurora X9",
    price: { value: 109, currency: "USD" },
    stock: "Low stock",
  },
];

assert(
  validateHealingPreview(previous, validPreview).valid,
  "accepts a live-shape preview without input echo or price symbol",
);

const missingField = validateHealingPreview(previous, [
  { title: "Aurora X9", price: { value: 109, currency: "USD" } },
]);
assert(!missingField.valid, "rejects a preview with a missing scraped field");
assert(
  missingField.reason?.includes("stock") === true,
  "reports the missing field",
);

const changedType = validateHealingPreview(previous, [
  { title: "Aurora X9", price: "$109", stock: "Low stock" },
]);
assert(!changedType.valid, "rejects a preview with a changed field type");

const emptyPreview = validateHealingPreview(previous, []);
assert(!emptyPreview.valid, "rejects an empty preview");

// A legacy degraded run (only the input echo survived, marked succeeded
// before the degraded-status fix) leaves no required paths; the validator
// then accepts any content preview so the heal can still recover the watch.
const degradedRun = [{ input: { url: "https://example.com/product" } }];
const degradedBaseline = validateHealingPreview(degradedRun, validPreview);
assert(
  degradedBaseline.valid,
  "legacy degraded baseline accepts a content preview (recovery path)",
);
