import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { antennas } from "@/db/schema";
import { getStarlinkClient, hasStarlinkCredentials } from "@/lib/starlink";

export async function POST() {
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
