import { NextResponse } from "next/server";
import { eq, sql, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { antennas } from "@/db/schema";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

async function isAuthorized(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionMatch = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  const sessionToken = sessionMatch?.slice(SESSION_COOKIE.length + 1);
  if (await verifySessionToken(sessionToken)) return true;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${cronSecret}`;
}

// One-off cleanup: an earlier version of the sync backfilled `location` from
// Starlink's /addresses endpoint, which turned out to be a generic
// billing/compliance address reused across every service line on an
// account — not the real per-site install location. This applies across
// every Starlink account, not just one: it clears `location` wherever the
// exact same text repeats suspiciously often across the whole table (a real,
// distinct manually-typed address would never repeat like this), so it
// never touches a genuinely unique manual entry.
const REPEAT_THRESHOLD = 5;

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const groups = await db
    .select({ location: antennas.location, count: sql<number>`count(*)` })
    .from(antennas)
    .where(isNotNull(antennas.location))
    .groupBy(antennas.location)
    .having(sql`count(*) >= ${REPEAT_THRESHOLD}`);

  let cleared = 0;
  const values: { value: string; count: number }[] = [];

  for (const group of groups) {
    if (!group.location) continue;
    const result = await db
      .update(antennas)
      .set({ location: null, updatedAt: new Date() })
      .where(eq(antennas.location, group.location))
      .returning({ id: antennas.id });
    cleared += result.length;
    values.push({ value: group.location, count: result.length });
  }

  return NextResponse.json({ cleared, values });
}
