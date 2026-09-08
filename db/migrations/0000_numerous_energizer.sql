CREATE TABLE "antennas" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_name" text NOT NULL,
	"location" text,
	"account_label" text,
	"terminal_id" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"signal_quality" numeric,
	"plan_name" text,
	"monthly_cost" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "antennas_terminal_id_unique" UNIQUE("terminal_id")
);
--> statement-breakpoint
CREATE TABLE "maintenance_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"antenna_id" integer NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maintenance_notes" ADD CONSTRAINT "maintenance_notes_antenna_id_antennas_id_fk" FOREIGN KEY ("antenna_id") REFERENCES "public"."antennas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_antennas_status" ON "antennas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notes_antenna_id" ON "maintenance_notes" USING btree ("antenna_id");