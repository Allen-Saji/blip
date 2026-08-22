import { validateUrl } from "./validation";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

function rejects(url: string, expected: string): void {
  assert(validateUrl(url) === expected, `${url} is rejected`);
}

assert(
  validateUrl("https://store.example.com/products/aurora-x9") === null,
  "accepts a public HTTPS page",
);
assert(
  validateUrl("https://8.8.8.8/products/aurora-x9") === null,
  "accepts a public IPv4 address",
);

rejects("ftp://example.com", "URL must use http or https");
rejects("https://user:password@example.com", "URL must not embed credentials");
rejects("http://localhost:3000", "URL must be publicly accessible");
rejects("http://api.localhost", "URL must be publicly accessible");
rejects("http://10.0.0.1", "URL must be publicly accessible");
rejects("http://172.16.0.1", "URL must be publicly accessible");
rejects("http://192.168.1.1", "URL must be publicly accessible");
rejects("http://127.0.0.1", "URL must be publicly accessible");
rejects("http://[::1]", "URL must be publicly accessible");
rejects("http://[fc00::1]", "URL must be publicly accessible");
rejects("http://[fe80::1]", "URL must be publicly accessible");
rejects("http://[::ffff:127.0.0.1]", "URL must be publicly accessible");
rejects("http://[::ffff:192.168.1.1]", "URL must be publicly accessible");
rejects("https://www.example.gov", "Government websites cannot be watched during Into the Scrape-Verse");
rejects("https://www.gov.uk", "Government websites cannot be watched during Into the Scrape-Verse");
rejects("https://meity.gov.in", "Government websites cannot be watched during Into the Scrape-Verse");

console.log("\nAll URL validation tests passed.");
