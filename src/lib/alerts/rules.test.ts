import { diffSnapshots } from "../diff/engine";
import { classifyChange } from "./rules";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const priceChange = diffSnapshots(
  [{ price: { value: 189, currency: "USD" }, stock: "In stock" }],
  [{ price: { value: 109, currency: "USD" }, stock: "In stock" }],
);
const priceAlert = classifyChange(priceChange, "price drops below $120");
assert(priceAlert.matched, "matches a numeric threshold rule");
assert(
  priceAlert.classification === "meaningful_change",
  "classifies a matched threshold as meaningful",
);

const unmatched = classifyChange(priceChange, "price drops below $80");
assert(!unmatched.matched, "does not match an unmet threshold");
assert(
  unmatched.classification === "unmatched_change",
  "classifies an unmet rule separately",
);

const drift = diffSnapshots(
  [{ price: { value: 189, currency: "USD" }, stock: "In stock" }],
  [{ price: { value: 189, currency: "USD" }, stock: null }],
);
const driftAlert = classifyChange(drift, "any meaningful change");
assert(
  driftAlert.classification === "extraction_drift",
  "classifies missing fields as extraction drift",
);

const stockChange = diffSnapshots(
  [{ stock: "Out of stock" }],
  [{ stock: "In stock" }],
);
assert(
  classifyChange(stockChange, "alert when back in stock").matched,
  "matches an availability rule",
);
