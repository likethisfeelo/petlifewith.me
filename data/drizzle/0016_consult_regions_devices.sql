DELETE FROM "experts" WHERE "kind"::text NOT IN ('trainer', 'mentor');--> statement-breakpoint
ALTER TYPE "public"."expert_kind" RENAME TO "expert_kind_old";--> statement-breakpoint
CREATE TYPE "public"."expert_kind" AS ENUM('trainer', 'mentor');--> statement-breakpoint
ALTER TABLE "experts" ALTER COLUMN "kind" TYPE "public"."expert_kind" USING "kind"::text::"public"."expert_kind";--> statement-breakpoint
DROP TYPE "public"."expert_kind_old";--> statement-breakpoint
DELETE FROM "service_requests" WHERE "kind"::text = 'expert_partner';--> statement-breakpoint
ALTER TYPE "public"."request_kind" RENAME TO "request_kind_old";--> statement-breakpoint
CREATE TYPE "public"."request_kind" AS ENUM('spot_register', 'spot_claim', 'maker_claim', 'promo_slot', 'care_partner');--> statement-breakpoint
ALTER TABLE "service_requests" ALTER COLUMN "kind" TYPE "public"."request_kind" USING "kind"::text::"public"."request_kind";--> statement-breakpoint
DROP TYPE "public"."request_kind_old";--> statement-breakpoint
CREATE TABLE "expert_regions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expert_regions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"expert_id" bigint NOT NULL,
	"region_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_dealers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "device_dealers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"device_model_id" bigint NOT NULL,
	"name" text NOT NULL,
	"region_id" integer,
	"url" text,
	"phone" text,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_models" ADD COLUMN "maker_url" text;--> statement-breakpoint
ALTER TABLE "device_models" ADD COLUMN "maker_contact_url" text;--> statement-breakpoint
ALTER TABLE "device_models" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "device_models" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "device_models" ADD COLUMN "home_use" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "device_models" ADD COLUMN "price_text" text;--> statement-breakpoint
ALTER TABLE "device_models" ADD COLUMN "featured_order" integer;--> statement-breakpoint
ALTER TABLE "device_sites" ADD COLUMN "kind" text DEFAULT 'hospital' NOT NULL;--> statement-breakpoint
ALTER TABLE "device_sites" ADD COLUMN "spot_id" bigint;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "sponsor_name" text;--> statement-breakpoint
ALTER TABLE "expert_regions" ADD CONSTRAINT "expert_regions_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_regions" ADD CONSTRAINT "expert_regions_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_dealers" ADD CONSTRAINT "device_dealers_device_model_id_device_models_id_fk" FOREIGN KEY ("device_model_id") REFERENCES "public"."device_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_dealers" ADD CONSTRAINT "device_dealers_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_sites" ADD CONSTRAINT "device_sites_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "expert_regions_expert_region_uq" ON "expert_regions" USING btree ("expert_id","region_id");--> statement-breakpoint
CREATE INDEX "expert_regions_region_idx" ON "expert_regions" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "device_dealers_device_idx" ON "device_dealers" USING btree ("device_model_id","sort_order");--> statement-breakpoint
CREATE INDEX "device_sites_spot_idx" ON "device_sites" USING btree ("spot_id");
