import { isIP } from "node:net";
import { z } from "zod";

export const createWatchSchema = z.object({
  url: z.string().url().max(2048),
  description: z.string().min(3).max(1000),
  alertRule: z.string().max(240).default("any meaningful change"),
  cadence: z.enum(["hourly", "daily", "weekly"]).default("daily"),
  email: z.string().email().max(254).optional(),
});

function isNonPublicIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51) ||
    (first === 203 && second === 0)
  );
}

function ipv4FromMappedIpv6(hostname: string): string | null {
  const match = hostname.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!match) return null;

  const firstWord = Number.parseInt(match[1], 16);
  const secondWord = Number.parseInt(match[2], 16);
  return [
    firstWord >> 8,
    firstWord & 0xff,
    secondWord >> 8,
    secondWord & 0xff,
  ].join(".");
}

function isNonPublicIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const mappedIpv4 = ipv4FromMappedIpv6(normalized);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    (mappedIpv4 !== null && isNonPublicIpv4(mappedIpv4))
  );
}

function isGovernmentHostname(hostname: string): boolean {
  const labels = hostname.replace(/^\[|\]$/g, "").split(".");
  return labels.includes("gov") || labels.includes("nic") || labels.includes("government") || hostname.endsWith(".mil");
}

export function validateUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "URL must use http or https";
    }

    if (parsed.username || parsed.password) {
      return "URL must not embed credentials";
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const ipVersion = isIP(hostname);
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".test") ||
      hostname.endsWith(".example") ||
      hostname.endsWith(".invalid") ||
      (ipVersion === 4 && isNonPublicIpv4(hostname)) ||
      (ipVersion === 6 && isNonPublicIpv6(hostname))
    ) {
      return "URL must be publicly accessible";
    }

    if (isGovernmentHostname(hostname)) {
      return "Government websites cannot be watched during Into the Scrape-Verse";
    }

    return null;
  } catch {
    return "Invalid URL";
  }
}
