import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { antennas, maintenanceNotes } from "@/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const antennaId = Number(id);

  const [antenna] = await db
    .select()
    .from(antennas)
    .where(eq(antennas.id, antennaId));

  if (!antenna) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  const notes = await db
    .select()
    .from(maintenanceNotes)
    .where(eq(maintenanceNotes.antennaId, antennaId))
    .orderBy(maintenanceNotes.createdAt);

  return NextResponse.json({ antenna, notes: notes.reverse() });
}

const EDITABLE_FIELDS = [
  "siteName",
  "location",
  "accountLabel",
  "terminalId",
  "kitSerialNumber",
  "planName",
  "monthlyCost",
  "status",
] as const;

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const antennaId = Number(id);
  const body = await request.json();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  const [updated] = await db
    .update(antennas)
    .set(updates)
    .where(eq(antennas.id, antennaId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json({ antenna: updated });
}
