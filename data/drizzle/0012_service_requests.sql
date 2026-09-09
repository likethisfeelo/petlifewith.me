CREATE TYPE "public"."request_kind" AS ENUM('spot_register', 'spot_claim', 'maker_claim', 'promo_slot', 'care_partner');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('new', 'in_progress', 'done', 'rejected');--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "service_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"kind" "request_kind" NOT NULL,
	"status" "request_status" DEFAULT 'new' NOT NULL,
	"spot_id" bigint,
	"maker_id" bigint,
	"requester_name" text NOT NULL,
	"contact" text NOT NULL,
	"biz_registration_no" text,
	"message" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"admin_note" text,
	"paid_at" timestamp with time zone,
	"ip_hash" text,
	"slack_sent_at" timestamp with time zone,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_maker_id_makers_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."makers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_requests_status_idx" ON "service_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "service_requests_kind_idx" ON "service_requests" USING btree ("kind");--> statement-breakpoint
INSERT INTO "service_requests" ("kind", "status", "spot_id", "maker_id", "requester_name", "contact", "biz_registration_no", "message", "payload", "handled_at", "created_at", "updated_at")
SELECT
	(CASE WHEN "target_type" = 'spot' THEN 'spot_claim' ELSE 'maker_claim' END)::"public"."request_kind",
	(CASE "status"::text WHEN 'pending' THEN 'new' WHEN 'approved' THEN 'done' ELSE 'rejected' END)::"public"."request_status",
	"spot_id", "maker_id", "claimant_name", "contact", "biz_registration_no", "message", '{}'::jsonb, "decided_at", "created_at", "created_at"
FROM "claims"
ORDER BY "id";--> statement-breakpoint
DROP TABLE "claims" CASCADE;--> statement-breakpoint
DROP TYPE "public"."claim_status";--> statement-breakpoint
DROP TYPE "public"."claim_target";
