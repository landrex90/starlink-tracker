import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { antennas } from "@/db/schema";
import { toCsv } from "@/lib/csv";

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
        ilike(antennas.kitSerialNumber, `%${q}%`),
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
    kit_serial_number: antennas.kitSerialNumber,
  } as const;

  const column = SORT_COLUMNS[sortBy as keyof typeof SORT_COLUMNS] ?? antennas.lastSeenAt;
  const orderBy = sortDir === "asc" ? asc(column) : desc(column);

  const rows = await db
    .select()
    .from(antennas)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(orderBy);

  const headers = [
    "site_name",
    "location",
    "latitude",
    "longitude",
    "account_label",
    "terminal_id",
    "kit_serial_number",
    "status",
    "last_seen_at",
    "signal_quality",
    "plan_name",
    "monthly_cost",
  ];

  const csvRows = rows.map((a) => [
    a.siteName,
    a.location,
    a.latitude,
    a.longitude,
    a.accountLabel,
    a.terminalId,
    a.kitSerialNumber,
    a.status,
    a.lastSeenAt ? a.lastSeenAt.toISOString() : "",
    a.signalQuality,
    a.planName,
    a.monthlyCost,
  ]);

  const csv = toCsv(headers, csvRows);
  const timestamp = new Date().toISOString().slice(0, 10);

  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="antenas-${timestamp}.csv"`,
    },
  });
}
