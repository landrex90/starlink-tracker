import { NextResponse } from "next/server";
import { eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { antennas } from "@/db/schema";
import { getStarlinkClient, hasStarlinkCredentials } from "@/lib/starlink";
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

// Clears `location` wherever the exact same text repeats suspiciously often
// across the whole table — leftover from an earlier bug that backfilled a
// generic per-account billing address instead of a real per-site one. A
// genuinely unique manual entry would never repeat like this, so this never
// touches one. Cheap enough (a handful of rows at our scale) to just run on
// every sync rather than needing a separate one-off action.
const REPEAT_THRESHOLD = 5;

async function clearRepeatedBadLocations(): Promise<number> {
  const groups = await db
    .select({ location: antennas.location, count: sql<number>`count(*)` })
    .from(antennas)
    .where(isNotNull(antennas.location))
    .groupBy(antennas.location)
    .having(sql`count(*) >= ${REPEAT_THRESHOLD}`);

  let cleared = 0;
  for (const group of groups) {
    if (!group.location) continue;
    const result = await db
      .update(antennas)
      .set({ location: null, updatedAt: new Date() })
      .where(eq(antennas.location, group.location))
      .returning({ id: antennas.id });
    cleared += result.length;
  }
  return cleared;
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!hasStarlinkCredentials()) {
    return NextResponse.json({
      mode: "mock",
      updated: 0,
      created: 0,
      errors: [],
      message: "No hay cuentas Starlink configuradas (STARLINK_ACCOUNTS) — nada que sincronizar.",
    });
  }

  const client = getStarlinkClient();
  const { terminals, errors } = await client.listTerminals();

  let updatedCount = 0;
  let createdCount = 0;

  for (const terminal of terminals) {
    const [existing] = await db
      .select({ id: antennas.id, siteName: antennas.siteName })
      .from(antennas)
      .where(eq(antennas.terminalId, terminal.terminalId));

    const latitude = terminal.latitude !== null ? String(terminal.latitude) : null;
    const longitude = terminal.longitude !== null ? String(terminal.longitude) : null;
    const status = terminal.online ? "online" : "offline";
    const lastSeenAt = terminal.lastSeenAt ? new Date(terminal.lastSeenAt) : null;
    const signalQuality = terminal.signalQuality !== null ? String(terminal.signalQuality) : null;

    if (!existing) {
      await db.insert(antennas).values({
        siteName: terminal.nickname || terminal.terminalId,
        accountLabel: terminal.accountLabel,
        terminalId: terminal.terminalId,
        kitSerialNumber: terminal.kitSerialNumber,
        latitude,
        longitude,
        status,
        lastSeenAt,
        signalQuality,
      });
      createdCount++;
      continue;
    }

    const updates: Record<string, unknown> = {
      status,
      lastSeenAt,
      signalQuality,
      kitSerialNumber: terminal.kitSerialNumber,
      // GPS coordinates have no manual-entry path in the UI, so they're
      // always safe to keep in sync with Starlink's records.
      latitude,
      longitude,
      updatedAt: new Date(),
    };

    // Fill in the real Starlink name only if site_name still looks
    // auto-generated (equals the raw terminal_id) — never overwrite a name
    // the user has since edited by hand.
    if (
      terminal.nickname &&
      terminal.nickname !== terminal.terminalId &&
      existing.siteName === terminal.terminalId
    ) {
      updates.siteName = terminal.nickname;
    }

    await db.update(antennas).set(updates).where(eq(antennas.id, existing.id));
    updatedCount++;
  }

  const locationsCleared = await clearRepeatedBadLocations();

  return NextResponse.json({
    mode: "live",
    updated: updatedCount,
    created: createdCount,
    locationsCleared,
    errors,
  });
}
