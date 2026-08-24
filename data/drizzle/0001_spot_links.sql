CREATE TABLE "spot_links" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "spot_links_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"spot_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spot_links" ADD CONSTRAINT "spot_links_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spot_links_spot_idx" ON "spot_links" USING btree ("spot_id");--> statement-breakpoint
ALTER TABLE "spots" DROP COLUMN "reservation_url";--> statement-breakpoint
ALTER TABLE "spots" DROP COLUMN "homepage_url";--> statement-breakpoint
ALTER TABLE "spots" DROP COLUMN "instagram_url";