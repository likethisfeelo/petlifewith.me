CREATE TYPE "public"."meetup_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "user_regions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_regions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"region_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetups" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meetups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"region_id" integer NOT NULL,
	"host_user_id" uuid,
	"description_md" text,
	"place_text" text,
	"meeting_at" timestamp with time zone,
	"capacity" integer,
	"status" "meetup_status" DEFAULT 'open' NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "meetup_members" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meetup_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"meetup_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetup_posts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meetup_posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"meetup_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_regions" ADD CONSTRAINT "user_regions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_regions" ADD CONSTRAINT "user_regions_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetups" ADD CONSTRAINT "meetups_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetups" ADD CONSTRAINT "meetups_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_members" ADD CONSTRAINT "meetup_members_meetup_id_meetups_id_fk" FOREIGN KEY ("meetup_id") REFERENCES "public"."meetups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_members" ADD CONSTRAINT "meetup_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_posts" ADD CONSTRAINT "meetup_posts_meetup_id_meetups_id_fk" FOREIGN KEY ("meetup_id") REFERENCES "public"."meetups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetup_posts" ADD CONSTRAINT "meetup_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_regions_user_region_uq" ON "user_regions" USING btree ("user_id","region_id");--> statement-breakpoint
CREATE INDEX "user_regions_region_idx" ON "user_regions" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "meetups_region_idx" ON "meetups" USING btree ("region_id","created_at");--> statement-breakpoint
CREATE INDEX "meetups_host_idx" ON "meetups" USING btree ("host_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meetup_members_meetup_user_uq" ON "meetup_members" USING btree ("meetup_id","user_id");--> statement-breakpoint
CREATE INDEX "meetup_members_user_idx" ON "meetup_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meetup_posts_meetup_idx" ON "meetup_posts" USING btree ("meetup_id","created_at");--> statement-breakpoint
CREATE INDEX "meetup_posts_user_idx" ON "meetup_posts" USING btree ("user_id","created_at");
