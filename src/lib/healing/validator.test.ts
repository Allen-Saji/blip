import { validateHealingPreview } from "./validator";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const previous = [
  {
    title: "Aurora X9",
    price: { value: 189, currency: "USD" },
    stock: "In stock",
  },
];

const validPreview = [
  {
    title: "Aurora X9",
    price: { value: 109, currency: "USD" },
    stock: "Low stock",
  },
];

assert(
  validateHealingPreview(previous, validPreview).valid,
  "accepts a preview that preserves fields and types",
);

const missingField = validateHealingPreview(previous, [
  { title: "Aurora X9", price: { value: 109, currency: "USD" } },
]);
assert(!missingField.valid, "rejects a preview with a missing field");
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
