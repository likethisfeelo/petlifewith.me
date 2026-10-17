CREATE TABLE "gsc_daily_totals" (
	"date" date PRIMARY KEY NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"ctr" double precision NOT NULL,
	"position" double precision NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_query_daily" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "gsc_query_daily_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"query" text NOT NULL,
	"page" text NOT NULL,
	"device" text NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"ctr" double precision NOT NULL,
	"position" double precision NOT NULL
);
--> statement-breakpoint
CREATE INDEX "gsc_query_daily_date_idx" ON "gsc_query_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX "gsc_query_daily_query_idx" ON "gsc_query_daily" USING btree ("query");--> statement-breakpoint
CREATE INDEX "gsc_query_daily_page_date_idx" ON "gsc_query_daily" USING btree ("page","date");