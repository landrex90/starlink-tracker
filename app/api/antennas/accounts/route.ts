import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { antennas } from "@/db/schema";

export async function GET() {
  const rows = await db
    .selectDistinct({ accountLabel: antennas.accountLabel })
    .from(antennas)
    .where(isNotNull(antennas.accountLabel));

  const accounts = rows
    .map((r) => r.accountLabel)
    .filter((label): label is string => Boolean(label))
    .sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ accounts });
}
