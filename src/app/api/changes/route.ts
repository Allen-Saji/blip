import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { changes, watches } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const sessionId = req.cookies.get("blip_session")?.value;
  if (!sessionId) {
    return NextResponse.json({ changes: [] });
  }

  const result = await db
    .select({
      change: changes,
      watchUrl: watches.url,
      watchDescription: watches.description,
    })
    .from(changes)
    .innerJoin(watches, eq(changes.watchId, watches.id))
    .where(eq(watches.sessionId, sessionId))
    .orderBy(desc(changes.createdAt))
    .limit(50);

  return NextResponse.json({ changes: result });
}
