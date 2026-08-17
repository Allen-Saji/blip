import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watches } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createWatchSchema, validateUrl } from "@/lib/validation";
import { enqueueJob } from "@/lib/jobs/queue";

// Guest watch limit: 1. Account watch limit: 3.
const GUEST_LIMIT = 1;

function getSessionId(req: NextRequest): { id: string; isNew: boolean } {
  const existing = req.cookies.get("blip_session")?.value;
  if (existing) return { id: existing, isNew: false };
  return { id: crypto.randomUUID(), isNew: true };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createWatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const urlError = validateUrl(parsed.data.url);
  if (urlError) {
    return NextResponse.json({ error: urlError }, { status: 400 });
  }

  // Guest-first: no auth required. A logged-in user would have a session too,
  // but for the demo, every watch is scoped to the browser session.
  const { id: sessionId, isNew } = getSessionId(req);

  const existing = await db
    .select()
    .from(watches)
    .where(eq(watches.sessionId, sessionId));

  if (existing.length >= GUEST_LIMIT) {
    return NextResponse.json(
      { error: "Guest accounts can track 1 page at a time. Sign in to track more." },
      { status: 429 },
    );
  }

  const watch = await db
    .insert(watches)
    .values({
      sessionId,
      url: parsed.data.url,
      description: parsed.data.description,
      cadence: parsed.data.cadence,
      status: "creating",
    })
    .returning();

  await enqueueJob("create", watch[0].id, {
    url: parsed.data.url,
    description: parsed.data.description,
  });

  const response = NextResponse.json({ watch: watch[0] }, { status: 202 });
  if (isNew) {
    response.cookies.set({
      name: "blip_session",
      value: sessionId,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }
  return response;
}

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("blip_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ watches: [] });
  }

  const result = await db
    .select()
    .from(watches)
    .where(eq(watches.sessionId, sessionId))
    .orderBy(desc(watches.createdAt));

  return NextResponse.json({ watches: result });
}
