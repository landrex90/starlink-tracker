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
  return verifySessionToken(sessionToken);
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!hasStarlinkCredentials()) {
    return NextResponse.json({ created: 0, errors: [] });
  }

  const client = getStarlinkClient();
  const { terminals, errors } = await client.listTerminals();

  let created = 0;

  for (const terminal of terminals) {
    const [existing] = await db
      .select({ id: antennas.id })
      .from(antennas)
      .where(eq(antennas.terminalId, terminal.terminalId));

    if (existing) continue;

    await db.insert(antennas).values({
      siteName: terminal.nickname || terminal.terminalId,
      accountLabel: terminal.accountLabel,
      terminalId: terminal.terminalId,
      kitSerialNumber: terminal.kitSerialNumber,
      status: terminal.online ? "online" : "offline",
      lastSeenAt: terminal.lastSeenAt ? new Date(terminal.lastSeenAt) : null,
      signalQuality: terminal.signalQuality !== null ? String(terminal.signalQuality) : null,
    });
    created++;
  }

  return NextResponse.json({ created, errors });
}
