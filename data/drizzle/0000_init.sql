CREATE TYPE "public"."claim_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."claim_target" AS ENUM('spot', 'maker');--> statement-breakpoint
CREATE TYPE "public"."device_category" AS ENUM('laser', 'stethoscope', 'imaging', 'monitor', 'rehab_equipment', 'other');--> statement-breakpoint
CREATE TYPE "public"."embed_source" AS ENUM('youtube', 'instagram', 'none');--> statement-breakpoint
CREATE TYPE "public"."guide_role" AS ENUM('hub', 'spoke');--> statement-breakpoint
CREATE TYPE "public"."guide_status" AS ENUM('draft', 'review_pending', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."maker_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."offer_vendor" AS ENUM('coupang', 'brand_store', 'other');--> statement-breakpoint
CREATE TYPE "public"."promotion_kind" AS ENUM('region_top', 'content_card');--> statement-breakpoint
CREATE TYPE "public"."spot_source" AS ENUM('public_data', 'direct', 'claimed', 'sample');--> statement-breakpoint
CREATE TYPE "public"."spot_status" AS ENUM('operating', 'suspended', 'closed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."topic_phase" AS ENUM('initial', 'secondary', 'always');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor', 'owner', 'member');--> statement-breakpoint
CREATE TABLE "claims" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "claims_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"target_type" "claim_target" NOT NULL,
	"spot_id" bigint,
	"maker_id" bigint,
	"claimant_name" text NOT NULL,
	"contact" text NOT NULL,
	"biz_registration_no" text,
	"message" text,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claims_exactly_one_target" CHECK (("claims"."target_type" = 'spot' AND "claims"."spot_id" IS NOT NULL AND "claims"."maker_id" IS NULL)
       OR ("claims"."target_type" = 'maker' AND "claims"."maker_id" IS NOT NULL AND "claims"."spot_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "curation_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "curation_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"curation_id" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"embed_source" "embed_source" DEFAULT 'none' NOT NULL,
	"embed_ref" text,
	"creator_name" text NOT NULL,
	"original_url" text NOT NULL,
	"summary_md" text NOT NULL,
	CONSTRAINT "curation_entries_embed_ref_required" CHECK ("curation_entries"."embed_source" = 'none' OR "curation_entries"."embed_ref" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "curations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "curations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"theme_slug" text NOT NULL,
	"title" text NOT NULL,
	"intro_md" text,
	"status" "guide_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curations_theme_slug_unique" UNIQUE("theme_slug")
);
--> statement-breakpoint
CREATE TABLE "device_models" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "device_models_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"maker_name" text,
	"category" "device_category" DEFAULT 'other' NOT NULL,
	"summary_md" text,
	"specs_md" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_models_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "device_sites" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "device_sites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"device_model_id" bigint NOT NULL,
	"facility_name" text NOT NULL,
	"region_id" integer,
	"verified_at" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_licenses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feed_licenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_name" text NOT NULL,
	"license_kind" text,
	"region_id" integer,
	"registered_at" date,
	"biz_status" text,
	"license_mgmt_no" text,
	"reference_date" date,
	"source_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feed_licenses_license_mgmt_no_unique" UNIQUE("license_mgmt_no")
);
--> statement-breakpoint
CREATE TABLE "guide_device_tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "guide_device_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"guide_id" bigint NOT NULL,
	"device_model_id" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guide_item_tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "guide_item_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"guide_id" bigint NOT NULL,
	"item_id" bigint NOT NULL,
	"context_label" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guide_maker_tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "guide_maker_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"guide_id" bigint NOT NULL,
	"maker_id" bigint NOT NULL,
	"context_label" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guide_spot_tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "guide_spot_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"guide_id" bigint NOT NULL,
	"spot_id" bigint NOT NULL,
	"context_label" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guides" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "guides_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body_md" text DEFAULT '' NOT NULL,
	"topic_id" integer NOT NULL,
	"role" "guide_role" DEFAULT 'spoke' NOT NULL,
	"spoke_group" text,
	"status" "guide_status" DEFAULT 'draft' NOT NULL,
	"medical_adjacent" boolean DEFAULT false NOT NULL,
	"vet_reviewed" boolean DEFAULT false NOT NULL,
	"vet_reviewer_name" text,
	"vet_reviewed_at" date,
	"hero_image_key" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guides_slug_unique" UNIQUE("slug"),
	CONSTRAINT "guides_medical_review_gate" CHECK ("guides"."status" <> 'published' OR "guides"."medical_adjacent" = false OR "guides"."vet_reviewed" = true)
);
--> statement-breakpoint
CREATE TABLE "item_offers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "item_offers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"item_id" bigint NOT NULL,
	"vendor" "offer_vendor" NOT NULL,
	"url" text NOT NULL,
	"is_affiliate" boolean DEFAULT false NOT NULL,
	"label" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"maker_id" bigint,
	"category" text NOT NULL,
	"summary" text,
	"description_md" text,
	"image_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "maker_links" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "maker_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"maker_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "makers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "makers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"region_id" integer,
	"story_md" text,
	"feed_license_id" bigint,
	"badge_feed_registered" boolean DEFAULT false NOT NULL,
	"badge_ingredient_registered" boolean DEFAULT false NOT NULL,
	"badge_verified_at" date,
	"badge_note" text,
	"selection_memo" text,
	"status" "maker_status" DEFAULT 'draft' NOT NULL,
	"claimed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "makers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "promotions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"spot_id" bigint NOT NULL,
	"kind" "promotion_kind" NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "region_dog_stats" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "region_dog_stats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"region_id" integer NOT NULL,
	"birth_year" integer NOT NULL,
	"registered_count" integer NOT NULL,
	"reference_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "regions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sido_name" text NOT NULL,
	"sido_slug" text NOT NULL,
	"sigungu_name" text NOT NULL,
	"sigungu_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spot_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "spot_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"monetizable" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "spot_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "spots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "spots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	"address_road" text,
	"phone" text,
	"status" "spot_status" DEFAULT 'unknown' NOT NULL,
	"source" "spot_source" DEFAULT 'public_data' NOT NULL,
	"license_mgmt_no" text,
	"license_date" date,
	"data_reference_date" date,
	"raw_coord_x" double precision,
	"raw_coord_y" double precision,
	"raw_coord_system" text,
	"lat" double precision,
	"lng" double precision,
	"description_md" text,
	"hours_text" text,
	"price_text" text,
	"parking_text" text,
	"reservation_url" text,
	"homepage_url" text,
	"instagram_url" text,
	"hero_image_key" text,
	"claimed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spots_license_mgmt_no_unique" UNIQUE("license_mgmt_no")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "topics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"phase" "topic_phase" DEFAULT 'initial' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cognito_sub" text,
	"email" text,
	"display_name" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_cognito_sub_unique" UNIQUE("cognito_sub"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_maker_id_makers_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."makers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curation_entries" ADD CONSTRAINT "curation_entries_curation_id_curations_id_fk" FOREIGN KEY ("curation_id") REFERENCES "public"."curations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_sites" ADD CONSTRAINT "device_sites_device_model_id_device_models_id_fk" FOREIGN KEY ("device_model_id") REFERENCES "public"."device_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_sites" ADD CONSTRAINT "device_sites_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_licenses" ADD CONSTRAINT "feed_licenses_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_device_tags" ADD CONSTRAINT "guide_device_tags_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_device_tags" ADD CONSTRAINT "guide_device_tags_device_model_id_device_models_id_fk" FOREIGN KEY ("device_model_id") REFERENCES "public"."device_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_item_tags" ADD CONSTRAINT "guide_item_tags_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_item_tags" ADD CONSTRAINT "guide_item_tags_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_maker_tags" ADD CONSTRAINT "guide_maker_tags_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_maker_tags" ADD CONSTRAINT "guide_maker_tags_maker_id_makers_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."makers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_spot_tags" ADD CONSTRAINT "guide_spot_tags_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_spot_tags" ADD CONSTRAINT "guide_spot_tags_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guides" ADD CONSTRAINT "guides_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_offers" ADD CONSTRAINT "item_offers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_maker_id_makers_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."makers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maker_links" ADD CONSTRAINT "maker_links_maker_id_makers_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."makers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "makers" ADD CONSTRAINT "makers_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "makers" ADD CONSTRAINT "makers_feed_license_id_feed_licenses_id_fk" FOREIGN KEY ("feed_license_id") REFERENCES "public"."feed_licenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "makers" ADD CONSTRAINT "makers_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_dog_stats" ADD CONSTRAINT "region_dog_stats_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_type_id_spot_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."spot_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claims_status_idx" ON "claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "curation_entries_curation_idx" ON "curation_entries" USING btree ("curation_id");--> statement-breakpoint
CREATE INDEX "device_sites_device_idx" ON "device_sites" USING btree ("device_model_id");--> statement-breakpoint
CREATE INDEX "feed_licenses_name_idx" ON "feed_licenses" USING btree ("business_name");--> statement-breakpoint
CREATE UNIQUE INDEX "guide_device_tags_uq" ON "guide_device_tags" USING btree ("guide_id","device_model_id");--> statement-breakpoint
CREATE INDEX "guide_device_tags_device_idx" ON "guide_device_tags" USING btree ("device_model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guide_item_tags_uq" ON "guide_item_tags" USING btree ("guide_id","item_id");--> statement-breakpoint
CREATE INDEX "guide_item_tags_item_idx" ON "guide_item_tags" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guide_maker_tags_uq" ON "guide_maker_tags" USING btree ("guide_id","maker_id");--> statement-breakpoint
CREATE INDEX "guide_maker_tags_maker_idx" ON "guide_maker_tags" USING btree ("maker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guide_spot_tags_uq" ON "guide_spot_tags" USING btree ("guide_id","spot_id");--> statement-breakpoint
CREATE INDEX "guide_spot_tags_spot_idx" ON "guide_spot_tags" USING btree ("spot_id");--> statement-breakpoint
CREATE INDEX "guides_topic_idx" ON "guides" USING btree ("topic_id","status");--> statement-breakpoint
CREATE INDEX "guides_status_idx" ON "guides" USING btree ("status");--> statement-breakpoint
CREATE INDEX "item_offers_item_idx" ON "item_offers" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "items_maker_idx" ON "items" USING btree ("maker_id");--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "maker_links_maker_idx" ON "maker_links" USING btree ("maker_id");--> statement-breakpoint
CREATE INDEX "makers_status_idx" ON "makers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "makers_category_idx" ON "makers" USING btree ("category");--> statement-breakpoint
CREATE INDEX "promotions_spot_idx" ON "promotions" USING btree ("spot_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "region_dog_stats_uq" ON "region_dog_stats" USING btree ("region_id","birth_year","reference_date");--> statement-breakpoint
CREATE INDEX "region_dog_stats_region_idx" ON "region_dog_stats" USING btree ("region_id");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_slug_uq" ON "regions" USING btree ("sido_slug","sigungu_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_name_uq" ON "regions" USING btree ("sido_name","sigungu_name");--> statement-breakpoint
CREATE INDEX "spots_region_type_idx" ON "spots" USING btree ("region_id","type_id","status");--> statement-breakpoint
CREATE INDEX "spots_type_idx" ON "spots" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "spots_source_idx" ON "spots" USING btree ("source");