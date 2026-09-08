import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { maintenanceNotes } from "@/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const antennaId = Number(id);
  const { note } = await request.json();

  if (typeof note !== "string" || note.trim().length === 0) {
    return NextResponse.json({ error: "La nota no puede estar vacía" }, { status: 400 });
  }

  const [created] = await db
    .insert(maintenanceNotes)
    .values({ antennaId, note: note.trim() })
    .returning();

  return NextResponse.json({ note: created }, { status: 201 });
}
