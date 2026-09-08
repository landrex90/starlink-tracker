import {
  pgTable,
  serial,
  text,
  timestamp,
  numeric,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const antennas = pgTable(
  "antennas",
  {
    id: serial("id").primaryKey(),
    siteName: text("site_name").notNull(),
    location: text("location"),
    latitude: numeric("latitude"),
    longitude: numeric("longitude"),
    accountLabel: text("account_label"), // which Starlink account this terminal belongs to
    terminalId: text("terminal_id").unique(),
    kitSerialNumber: text("kit_serial_number"), // physical dish kit serial (# KIT)
    status: text("status").notNull().default("unknown"), // 'online' | 'offline' | 'unknown'
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    signalQuality: numeric("signal_quality"),
    planName: text("plan_name"),
    monthlyCost: numeric("monthly_cost", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_antennas_status").on(table.status)],
);

export const maintenanceNotes = pgTable(
  "maintenance_notes",
  {
    id: serial("id").primaryKey(),
    antennaId: integer("antenna_id")
      .notNull()
      .references(() => antennas.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_notes_antenna_id").on(table.antennaId)],
);

export type Antenna = typeof antennas.$inferSelect;
export type NewAntenna = typeof antennas.$inferInsert;
export type MaintenanceNote = typeof maintenanceNotes.$inferSelect;
export type NewMaintenanceNote = typeof maintenanceNotes.$inferInsert;
