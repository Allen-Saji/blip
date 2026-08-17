import { diffSnapshots } from "./engine";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

// 1. Flat field change
const flat = diffSnapshots({ price: 100 }, { price: 90 });
assert(flat.diff.length === 1, "flat change detected");
assert(flat.diff[0].path === "price", "flat path correct");
assert(flat.summary.includes("price"), "flat summary includes field");
assert(!flat.hasMissingFields, "flat change is not a missing field");

// 2. Nested object change
const nested = diffSnapshots(
  { price: { value: 100, currency: "USD" } },
  { price: { value: 90, currency: "USD" } },
);
assert(nested.diff.length === 1, "nested change detected");
assert(nested.diff[0].path === "price.value", "nested path correct");
assert(!nested.hasMissingFields, "nested change not missing");

// 3. Field went null (site moved signal)
const missing = diffSnapshots(
  { price: { value: 100 } },
  { price: null },
);
assert(missing.diff.length === 1, "null change detected");
assert(missing.hasMissingFields, "null change flagged as missing field");

// 4. Field removed entirely
const removed = diffSnapshots({ price: 100, title: "x" }, { title: "x" });
assert(removed.diff.length === 1, "removed field detected");
assert(removed.hasMissingFields, "removed field flagged as missing");

// 5. No change
const same = diffSnapshots({ price: 100 }, { price: 100 });
assert(same.diff.length === 0, "no change detected");
assert(same.summary === "No changes detected.", "no-change summary");

// 6. New field added (not a missing field)
const added = diffSnapshots({ price: 100 }, { price: 100, stock: "in" });
assert(added.diff.length === 1, "added field detected");
assert(!added.hasMissingFields, "added field is not missing");

// 7. Array handling
const arr = diffSnapshots([{ price: 1 }], [{ price: 2 }]);
assert(arr.diff.length === 1, "array element change detected");
assert(arr.diff[0].path === "[0].price", "array path correct");

console.log("\nAll diff engine tests passed.");
