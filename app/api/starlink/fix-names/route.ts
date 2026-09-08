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

// Corrects site_name for antennas that were auto-created with the raw
// terminal_id as a placeholder name (before we started reading the Starlink
// service-line nickname). Only touches rows whose site_name still equals
// their terminal_id verbatim — anything the user has since renamed by hand
// is left alone.
export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!hasStarlinkCredentials()) {
    return NextResponse.json({ fixed: 0, errors: [] });
  }

  const client = getStarlinkClient();
  const { terminals, errors } = await client.listTerminals();

  let fixed = 0;

  for (const terminal of terminals) {
    if (!terminal.nickname || terminal.nickname === terminal.terminalId) continue;

    const [existing] = await db
      .select({ id: antennas.id, siteName: antennas.siteName })
      .from(antennas)
      .where(eq(antennas.terminalId, terminal.terminalId));

    if (!existing || existing.siteName !== terminal.terminalId) continue;

    await db
      .update(antennas)
      .set({ siteName: terminal.nickname, updatedAt: new Date() })
      .where(eq(antennas.id, existing.id));
    fixed++;
  }

  return NextResponse.json({ fixed, errors });
}
