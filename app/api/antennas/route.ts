import { NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { antennas } from "@/db/schema";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const account = searchParams.get("account");
  const q = searchParams.get("q");
  const sortBy = searchParams.get("sortBy") ?? "last_seen_at";
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

  const conditions = [];
  if (status) conditions.push(eq(antennas.status, status));
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

  const SORT_COLUMNS = {
    site_name: antennas.siteName,
    account_label: antennas.accountLabel,
    status: antennas.status,
    last_seen_at: antennas.lastSeenAt,
    plan_name: antennas.planName,
    monthly_cost: antennas.monthlyCost,
  } as const;

  const column = SORT_COLUMNS[sortBy as keyof typeof SORT_COLUMNS] ?? antennas.lastSeenAt;
  const orderBy = sortDir === "asc" ? asc(column) : desc(column);

  const rows = await db
    .select()
    .from(antennas)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(orderBy);

  return NextResponse.json({ antennas: rows });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.siteName || typeof body.siteName !== "string") {
    return NextResponse.json({ error: "site_name es requerido" }, { status: 400 });
  }

  const [created] = await db
    .insert(antennas)
    .values({
      siteName: body.siteName,
      location: body.location ?? null,
      accountLabel: body.accountLabel ?? null,
      terminalId: body.terminalId ?? null,
      planName: body.planName ?? null,
      monthlyCost: body.monthlyCost ?? null,
      status: body.status ?? "unknown",
    })
    .returning();

  return NextResponse.json({ antenna: created }, { status: 201 });
}
