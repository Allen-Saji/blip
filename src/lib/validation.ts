import { z } from "zod";

export const createWatchSchema = z.object({
  url: z.string().url().max(2048),
  description: z.string().min(3).max(1000),
  cadence: z.enum(["hourly", "daily", "weekly"]).default("daily"),
});

export function validateUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "URL must use http or https";
    }
    // Best-effort block on localhost/private (hackathon rule: public data only).
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return "URL must be publicly accessible";
    }
    return null;
  } catch {
    return "Invalid URL";
  }
}
