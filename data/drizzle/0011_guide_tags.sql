ALTER TABLE "guides" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "guides_tags_idx" ON "guides" USING gin ("tags");