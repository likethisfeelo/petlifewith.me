CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"object_key" text NOT NULL,
	"kind" "media_kind" NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"original_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "curations" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "curations" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "curations" ADD COLUMN "og_image_key" text;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "og_image_key" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "og_image_key" text;--> statement-breakpoint
ALTER TABLE "makers" ADD COLUMN "hero_image_key" text;--> statement-breakpoint
ALTER TABLE "makers" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "makers" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "makers" ADD COLUMN "og_image_key" text;--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "og_image_key" text;--> statement-breakpoint
CREATE INDEX "media_assets_kind_idx" ON "media_assets" USING btree ("kind","created_at");