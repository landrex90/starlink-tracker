import { NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { antennas } from "@/db/schema";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const sort = searchParams.get("sort") ?? "last_seen_desc";

  const conditions = [];
  if (status) conditions.push(eq(antennas.status, status));
  if (q) {
    conditions.push(
      or(
        ilike(antennas.siteName, `%${q}%`),
        ilike(antennas.location, `%${q}%`),
        ilike(antennas.terminalId, `%${q}%`),
      ),
    );
  }

  const orderBy =
    sort === "last_seen_asc"
      ? asc(antennas.lastSeenAt)
      : sort === "site_name"
        ? asc(antennas.siteName)
        : desc(antennas.lastSeenAt);

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
