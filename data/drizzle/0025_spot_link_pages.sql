CREATE TABLE "spot_media" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "spot_media_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"spot_id" bigint NOT NULL,
	"asset_id" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spot_page_stats" (
	"spot_id" bigint NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "spot_page_stats_spot_id_day_pk" PRIMARY KEY("spot_id","day")
);
--> statement-breakpoint
CREATE TABLE "spot_pages" (
	"spot_id" bigint PRIMARY KEY NOT NULL,
	"handle" text,
	"intro" text,
	"services" text[] DEFAULT '{}'::text[] NOT NULL,
	"paid_from" date,
	"paid_until" date,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spot_pages_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
ALTER TABLE "spot_media" ADD CONSTRAINT "spot_media_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_media" ADD CONSTRAINT "spot_media_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_page_stats" ADD CONSTRAINT "spot_page_stats_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_pages" ADD CONSTRAINT "spot_pages_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spot_media_spot_idx" ON "spot_media" USING btree ("spot_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "spot_media_uq" ON "spot_media" USING btree ("spot_id","asset_id");--> statement-breakpoint
CREATE INDEX "spot_pages_paid_idx" ON "spot_pages" USING btree ("paid_until");