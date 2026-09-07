CREATE TABLE "rehab_sites" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rehab_sites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"external_ref" text,
	"name" text NOT NULL,
	"region_id" integer NOT NULL,
	"address" text,
	"phone" text,
	"status" "spot_status" DEFAULT 'unknown' NOT NULL,
	"modalities" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_label" text,
	"evidence_note" text,
	"internal_level" text,
	"internal_note" text,
	"verified_at" date,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rehab_sites_external_ref_unique" UNIQUE("external_ref")
);
--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "external_ref" text;--> statement-breakpoint
ALTER TABLE "rehab_sites" ADD CONSTRAINT "rehab_sites_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rehab_sites_region_idx" ON "rehab_sites" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "rehab_sites_published_idx" ON "rehab_sites" USING btree ("published","name");--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_external_ref_unique" UNIQUE("external_ref");