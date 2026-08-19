import { NextResponse } from "next/server";
import { readFile } from "fs/promises";

/**
 * Demo fixture: a fake store page used to demonstrate Blip's change detection
 * and Scraper Studio self-healing end to end.
 *
 * The page's state is controlled by a JSON file on disk (default
 * /opt/blip/fixture-state.json on the droplet). States:
 *   { "state": "v1" }        — original layout, price $189, "In stock"
 *   { "state": "v2" }        — price drop to $109, "Low stock — 3 left"
 *   { "state": "redesign" }  — full layout change (new markup, price $79)
 *
 * The redesign state breaks the original collector's selectors, so the next
 * Blip run returns empty → triggers self-heal → the collector is refactored
 * against the new layout and keeps working. Judges see no gap.
 */

const STATE_FILE =
  process.env.FIXTURE_STATE_FILE ?? "/opt/blip/fixture-state.json";

async function readState(): Promise<string> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as { state?: string };
    return parsed.state ?? "v1";
  } catch {
    return "v1";
  }
}

export async function GET() {
  const state = await readState();

  if (state === "redesign") {
    return new NextResponse(
      [
        "<!doctype html>",
        '<html lang="en"><head>',
        '<meta charset="utf-8">',
        "<title>Aurora X9 — Wireless Earbuds</title>",
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        "</head><body>",
        '<main class="product-shell">',
        '<nav class="topbar"><a href="/">Aurora Audio</a></nav>',
        '<section class="hero">',
        '<h1 class="product-title">Aurora X9 Wireless Earbuds</h1>',
        '<p class="tagline">Active noise cancellation. 32h battery.</p>',
        "</section>",
        '<section class="pricing-card">',
        '<p class="label">Price</p>',
        '<div class="amount">$79</div>',
        '<p class="label">Availability</p>',
        '<div class="stock-badge">In stock — ships today</div>',
        '<button class="buy-button">Add to cart</button>',
        "</section>",
        '<section class="specs">',
        "<ul><li>Bluetooth 5.4</li><li>IPX5 water resistant</li><li>6 mics</li></ul>",
        "</section>",
        "</main></body></html>",
      ].join("\n"),
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const price = state === "v2" ? "$109" : "$189";
  const stock = state === "v2" ? "Low stock — 3 left" : "In stock";
  const rating = state === "v2" ? "4.6" : "4.8";

  return new NextResponse(
    [
      "<!doctype html>",
      '<html lang="en"><head>',
      '<meta charset="utf-8">',
      "<title>Aurora X9 — Wireless Earbuds</title>",
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "</head><body>",
      '<div class="product-page">',
      '<div class="header"><a href="/">Aurora Audio</a></div>',
      '<div class="product-info">',
      '<h1 class="product-name">Aurora X9 Wireless Earbuds</h1>',
      '<div class="product-rating">Rating: ' + rating + ' / 5</div>',
      '<div class="price-box"><span class="price">' + price + "</span></div>",
      '<div class="availability"><span class="stock">' + stock + "</span></div>",
      "</div>",
      "</div></body></html>",
    ].join("\n"),
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}
