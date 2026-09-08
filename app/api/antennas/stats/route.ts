import { NextResponse } from "next/server";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { antennas } from "@/db/schema";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const account = searchParams.get("account");
  const q = searchParams.get("q");

  // Intentionally ignores `status` — these tiles show the online/offline
  // breakdown itself, so filtering by status here would always read 100%.
  const conditions = [];
  if (account) conditions.push(eq(antennas.accountLabel, account));
  if (q) {
    conditions.push(
      or(
        ilike(antennas.siteName, `%${q}%`),
        ilike(antennas.location, `%${q}%`),
        ilike(antennas.terminalId, `%${q}%`),
      ),
    );
  }

  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      online: sql<number>`count(*) filter (where ${antennas.status} = 'online')`,
      offline: sql<number>`count(*) filter (where ${antennas.status} = 'offline')`,
      monthlyCost: sql<string>`coalesce(sum(${antennas.monthlyCost}), 0)`,
    })
    .from(antennas)
    .where(conditions.length ? and(...conditions) : undefined);

  const total = Number(row?.total ?? 0);
  const online = Number(row?.online ?? 0);
  const offline = Number(row?.offline ?? 0);
  const monthlyCost = Number(row?.monthlyCost ?? 0);
  const onlinePct = total > 0 ? Math.round((online / total) * 100) : 0;

  return NextResponse.json({ total, online, offline, monthlyCost, onlinePct });
}
