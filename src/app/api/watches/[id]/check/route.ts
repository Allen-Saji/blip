import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { watches, jobs } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";
import { enqueueJob } from "@/lib/jobs/queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sessionId = req.cookies.get("blip_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const watch = await db
    .select()
    .from(watches)
    .where(and(eq(watches.id, id), eq(watches.sessionId, sessionId)))
    .limit(1);

  if (watch.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Skip if a run is already queued/running for this watch.
  const active = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.watchId, id),
        or(eq(jobs.status, "queued"), eq(jobs.status, "running")),
        eq(jobs.type, "run"),
      ),
    )
    .limit(1);

  if (active.length > 0) {
    return NextResponse.json(
      { error: "A check is already in progress" },
      { status: 409 },
    );
  }

  await enqueueJob("run", id);
  return NextResponse.json({ ok: true });
}
