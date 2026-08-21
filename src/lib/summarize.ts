/**
 * AI change summaries via the Command Code Provider API (OpenAI-compatible).
 *
 * Uses the free `poolside/laguna-s-2.1-free` model, so notifications cost no
 * credits. Best-effort by design: any failure falls back to the mechanical
 * diff summary so a summary outage never blocks a notification.
 */

const API_URL =
  process.env.CMD_PROVIDER_URL ??
  "https://api.commandcode.ai/provider/v1/chat/completions";
const MODEL = process.env.CMD_SUMMARY_MODEL ?? "poolside/laguna-s-2.1-free";
const TIMEOUT_MS = 20_000;

export function isSummarizerConfigured(): boolean {
  return Boolean(process.env.CMD_API_KEY);
}

export async function generateChangeSummary(opts: {
  watchUrl: string;
  watchDescription: string;
  diff: { path: string; before: unknown; after: unknown }[];
}): Promise<string | null> {
  const apiKey = process.env.CMD_API_KEY;
  if (!apiKey) return null;
  if (opts.diff.length === 0) return null;

  const changesText = opts.diff
    .map(
      (entry) =>
        `- ${entry.path}: ${JSON.stringify(entry.before)} -> ${JSON.stringify(entry.after)}`,
    )
    .join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You write one-sentence change alerts for a web page monitoring " +
              "product. Describe what changed on the page in plain language, " +
              "grounded strictly in the provided field diffs. Never invent " +
              "values. Plain ASCII text only, no markdown, no quotes around " +
              "the sentence, at most 200 characters.",
          },
          {
            role: "user",
            content:
              `Page being watched: ${opts.watchUrl}\n` +
              `What the user asked to monitor: ${opts.watchDescription}\n\n` +
              `Field diffs:\n${changesText}\n\n` +
              `Write the one-sentence alert.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error(`summary request failed: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    // Strip wrapping quotes some models add despite instructions.
    const cleaned = content.replace(/^["']|["']$/g, "").trim();
    return cleaned.length > 0 ? cleaned : null;
  } catch (err) {
    console.error(
      "summary generation failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}
