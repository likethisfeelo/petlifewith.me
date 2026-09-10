ALTER TYPE "public"."request_kind" ADD VALUE 'expert_partner';--> statement-breakpoint
CREATE TYPE "public"."expert_kind" AS ENUM('trainer', 'vet', 'vet_tech', 'mentor');--> statement-breakpoint
CREATE TYPE "public"."expert_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."reservation_kind" AS ENUM('care', 'spot', 'consult');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('new', 'confirmed', 'paid', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "experts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "experts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"kind" "expert_kind" NOT NULL,
	"display_name" text NOT NULL,
	"intro_md" text,
	"credentials_text" text,
	"credentials_verified_at" date,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"modes" text[] DEFAULT '{}'::text[] NOT NULL,
	"price_text" text,
	"hero_image_key" text,
	"user_id" uuid,
	"contact" text,
	"status" "expert_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "expert_slots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expert_slots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"expert_id" bigint NOT NULL,
	"weekday" integer NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reservations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"kind" "reservation_kind" NOT NULL,
	"status" "reservation_status" DEFAULT 'new' NOT NULL,
	"spot_id" bigint,
	"expert_id" bigint,
	"target_name" text NOT NULL,
	"service_kind" text,
	"region_id" integer,
	"area_label" text,
	"user_id" uuid,
	"provider_user_id" uuid,
	"requester_name" text NOT NULL,
	"contact" text NOT NULL,
	"pet_note" text,
	"mode" text,
	"slot_start" timestamp with time zone,
	"slot_end" timestamp with time zone,
	"preferred_text" text,
	"topic" text,
	"message" text,
	"paid_at" timestamp with time zone,
	"paid_by" text,
	"admin_note" text,
	"ip_hash" text,
	"slack_sent_at" timestamp with time zone,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "conversations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"reservation_id" bigint NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_reservation_id_unique" UNIQUE("reservation_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"conversation_id" bigint NOT NULL,
	"sender_user_id" uuid,
	"sender_role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experts" ADD CONSTRAINT "experts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_slots" ADD CONSTRAINT "expert_slots_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_expert_id_experts_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."experts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_provider_user_id_users_id_fk" FOREIGN KEY ("provider_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experts_status_idx" ON "experts" USING btree ("status","sort_order");--> statement-breakpoint
CREATE INDEX "experts_user_idx" ON "experts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expert_slots_expert_idx" ON "expert_slots" USING btree ("expert_id","weekday");--> statement-breakpoint
CREATE INDEX "reservations_user_idx" ON "reservations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "reservations_provider_idx" ON "reservations" USING btree ("provider_user_id","status");--> statement-breakpoint
CREATE INDEX "reservations_expert_slot_idx" ON "reservations" USING btree ("expert_id","slot_start");--> statement-breakpoint
CREATE INDEX "reservations_status_idx" ON "reservations" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","id");--> statement-breakpoint
INSERT INTO "reservations" ("kind", "status", "spot_id", "target_name", "service_kind", "region_id", "area_label", "requester_name", "contact", "pet_note", "preferred_text", "message", "ip_hash", "slack_sent_at", "handled_at", "created_at", "updated_at")
SELECT 'care'::"public"."reservation_kind", (CASE WHEN "handled_at" IS NULL THEN 'new' ELSE 'done' END)::"public"."reservation_status",
	"spot_id", "spot_name", "service_kind", "region_id", "area_label", "requester_name", "contact", "pet_note", "preferred_date", "message", "ip_hash", "slack_sent_at", "handled_at", "created_at", "created_at"
FROM "booking_requests" ORDER BY "id";--> statement-breakpoint
DROP TABLE "booking_requests" CASCADE;
