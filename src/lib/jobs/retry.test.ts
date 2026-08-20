import assert from "node:assert/strict";
import { canRetry, retryDelayMs } from "./retry";

assert.equal(canRetry(1), true);
assert.equal(canRetry(2), true);
assert.equal(canRetry(3), false);
assert.equal(retryDelayMs(1), 10_000);
assert.equal(retryDelayMs(2), 20_000);
assert.equal(retryDelayMs(3), 40_000);
assert.equal(retryDelayMs(5), 60_000);

console.log("retry tests passed");
