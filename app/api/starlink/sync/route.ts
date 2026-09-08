import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!hasStarlinkCredentials()) {
    return NextResponse.json({
      mode: "mock",
      updated: 0,
      unmatched: [],
      errors: [],
      message: "No hay cuentas Starlink configuradas (STARLINK_ACCOUNTS) — nada que sincronizar.",
    });
  }

  const client = getStarlinkClient();
  const { terminals, errors } = await client.listTerminals();

  let updatedCount = 0;
  const unmatched: { terminalId: string; nickname: string | null; accountLabel: string }[] = [];

  for (const terminal of terminals) {
    const [existing] = await db
      .select({ id: antennas.id })
      .from(antennas)
      .where(eq(antennas.terminalId, terminal.terminalId));

    if (!existing) {
      unmatched.push({
        terminalId: terminal.terminalId,
        nickname: terminal.nickname,
        accountLabel: terminal.accountLabel,
      });
      continue;
    }

    await db
      .update(antennas)
      .set({
        status: terminal.online ? "online" : "offline",
        lastSeenAt: terminal.lastSeenAt ? new Date(terminal.lastSeenAt) : null,
        signalQuality: terminal.signalQuality !== null ? String(terminal.signalQuality) : null,
        updatedAt: new Date(),
      })
      .where(eq(antennas.id, existing.id));
    updatedCount++;
  }

  return NextResponse.json({
    mode: "live",
    updated: updatedCount,
    unmatched,
    errors,
  });
}
