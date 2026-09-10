CREATE TYPE "public"."reaction_kind" AS ENUM('save', 'like');--> statement-breakpoint
CREATE TYPE "public"."reaction_target" AS ENUM('guide', 'spot', 'maker', 'item', 'meetup');--> statement-breakpoint
CREATE TABLE "contact_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contact_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"spot_id" bigint,
	"maker_id" bigint,
	"channel" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"target_type" "reaction_target" NOT NULL,
	"target_id" bigint NOT NULL,
	"kind" "reaction_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "contact_logs" ADD CONSTRAINT "contact_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_logs" ADD CONSTRAINT "contact_logs_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_logs" ADD CONSTRAINT "contact_logs_maker_id_makers_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."makers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_logs_user_idx" ON "contact_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reactions_user_target_uq" ON "reactions" USING btree ("user_id","target_type","target_id","kind");--> statement-breakpoint
CREATE INDEX "reactions_target_idx" ON "reactions" USING btree ("target_type","target_id","kind");--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_requests_user_idx" ON "service_requests" USING btree ("user_id");
