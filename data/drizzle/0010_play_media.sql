CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guides" ADD COLUMN "hero_media" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "poster_key" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "duration_sec" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "uploader_user_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploader_user_id_users_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_uploader_idx" ON "media_assets" USING btree ("uploader_user_id");