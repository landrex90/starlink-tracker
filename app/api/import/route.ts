import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { antennas, maintenanceNotes } from "@/db/schema";
import { parseAntennaCsv } from "@/lib/csv";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo CSV requerido" }, { status: 400 });
  }

  const text = await file.text();
  const { rows, errors } = parseAntennaCsv(text);

  let created = 0;
  let updated = 0;
  const rowErrors = [...errors];

  for (const row of rows) {
    try {
      const values = {
        siteName: row.site_name,
        location: row.location || null,
        terminalId: row.terminal_id || null,
        kitSerialNumber: row.kit_serial_number || null,
        planName: row.plan_name || null,
        monthlyCost: row.monthly_cost ? row.monthly_cost : null,
        status: row.status || "unknown",
      };

      let antennaId: number;

      if (values.terminalId) {
        const [existing] = await db
          .select({ id: antennas.id })
          .from(antennas)
          .where(eq(antennas.terminalId, values.terminalId));

        if (existing) {
          await db.update(antennas).set(values).where(eq(antennas.id, existing.id));
          antennaId = existing.id;
          updated++;
        } else {
          const [inserted] = await db.insert(antennas).values(values).returning({ id: antennas.id });
          antennaId = inserted.id;
          created++;
        }
      } else {
        const [inserted] = await db.insert(antennas).values(values).returning({ id: antennas.id });
        antennaId = inserted.id;
        created++;
      }

      if (row.notes && row.notes.trim()) {
        await db.insert(maintenanceNotes).values({ antennaId, note: row.notes.trim() });
      }
    } catch (err) {
      rowErrors.push(`${row.site_name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ created, updated, errors: rowErrors });
}
