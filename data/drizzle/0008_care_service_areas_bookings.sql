CREATE TABLE "booking_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "booking_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"spot_id" bigint,
	"spot_name" text NOT NULL,
	"service_kind" text NOT NULL,
	"region_id" integer,
	"area_label" text,
	"requester_name" text NOT NULL,
	"contact" text NOT NULL,
	"pet_note" text,
	"preferred_date" text,
	"message" text,
	"ip_hash" text,
	"slack_sent_at" timestamp with time zone,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spot_service_areas" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "spot_service_areas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"spot_id" bigint NOT NULL,
	"region_id" integer NOT NULL,
	"exposed" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_service_areas" ADD CONSTRAINT "spot_service_areas_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_service_areas" ADD CONSTRAINT "spot_service_areas_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_requests_created_idx" ON "booking_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "booking_requests_ip_idx" ON "booking_requests" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "spot_service_areas_uq" ON "spot_service_areas" USING btree ("spot_id","region_id");--> statement-breakpoint
CREATE INDEX "spot_service_areas_region_idx" ON "spot_service_areas" USING btree ("region_id","exposed");