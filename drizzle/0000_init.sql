CREATE TABLE "ai_usage" (
	"day" date PRIMARY KEY NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_hits" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_id" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"date" timestamp with time zone,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"rule" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "backtests" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"company" text NOT NULL,
	"domain" text,
	"announce_date" date,
	"announce_url" text,
	"announce_title" text,
	"verdict" text NOT NULL,
	"lead_days" integer,
	"flagged_on" date,
	"signal" text,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"courtside" boolean DEFAULT true NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "backtests_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"week" date NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "briefs_week_unique" UNIQUE("week")
);
--> statement-breakpoint
CREATE TABLE "cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"target" text,
	"before" jsonb,
	"after" jsonb,
	"visitor" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"description_url" text,
	"thesis_area" text,
	"pattern" text,
	"stage" text DEFAULT 'unknown' NOT NULL,
	"amount" double precision,
	"currency" text DEFAULT '$' NOT NULL,
	"why_fits" text,
	"why_fits_manual" boolean DEFAULT false NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"prev_score" integer DEFAULT 0 NOT NULL,
	"breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"portfolio_check" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"tracked" boolean DEFAULT false NOT NULL,
	"tracked_at" timestamp with time zone,
	"possible_match" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"site_snapshot" jsonb,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_signal" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "companies_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "courtside_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"date" timestamp with time zone,
	"kind" text NOT NULL,
	"summary" text,
	CONSTRAINT "courtside_posts_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"page" text NOT NULL,
	"element" text,
	"viewport" text,
	"theme" text,
	"browser" text,
	"chips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"me_too" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "filings" (
	"id" serial PRIMARY KEY NOT NULL,
	"accession" text NOT NULL,
	"form" text NOT NULL,
	"issuer" text NOT NULL,
	"cik" text,
	"industry" text,
	"amount_sold" double precision,
	"amount_offered" double precision,
	"currency" text DEFAULT '$' NOT NULL,
	"first_sale" text,
	"filed_at" timestamp with time zone,
	"related" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"thesis_area" text,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"url" text NOT NULL,
	"website" text,
	"before_press" boolean DEFAULT false NOT NULL,
	"company_id" integer,
	CONSTRAINT "filings_accession_unique" UNIQUE("accession")
);
--> statement-breakpoint
CREATE TABLE "fund_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"fund_id" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"date" timestamp with time zone,
	"company" text,
	"round" text,
	"amount" double precision,
	"currency" text DEFAULT '$' NOT NULL,
	"role" text,
	"thesis_area" text,
	"company_id" integer,
	"possible" boolean DEFAULT false NOT NULL,
	"source" text
);
--> statement-breakpoint
CREATE TABLE "funds" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"focus" text DEFAULT 'broad' NOT NULL,
	"thesis_area" text,
	"site" text,
	"note" text,
	"query" text,
	"feeds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"youtube" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edgar_name" text,
	"last_shared_date" date,
	"shared" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "funds_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"stage" text,
	"done" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"items" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"ai_calls" integer DEFAULT 0 NOT NULL,
	"cursor" jsonb,
	"log" text,
	"changes" jsonb
);
--> statement-breakpoint
CREATE TABLE "mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"kind" text NOT NULL,
	"stance" text NOT NULL,
	"quote" text,
	"url" text NOT NULL,
	"date" timestamp with time zone,
	"voice" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"body" text NOT NULL,
	"visitor" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"youtube" text,
	"blog" text,
	"github" text,
	"site" text,
	"tracked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "people_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "person_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"date" timestamp with time zone,
	"source" text
);
--> statement-breakpoint
CREATE TABLE "portfolio" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sector" text,
	"description" text,
	"description_url" text,
	"site" text,
	"exit_note" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "portfolio_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"date" timestamp with time zone,
	"voice" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "source_health" (
	"source" text PRIMARY KEY NOT NULL,
	"label" text,
	"last_ok" timestamp with time zone,
	"last_error" timestamp with time zone,
	"error_text" text,
	"items" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sponsor_sightings" (
	"id" serial PRIMARY KEY NOT NULL,
	"sponsor_id" integer NOT NULL,
	"show" text NOT NULL,
	"date" timestamp with time zone,
	"url" text NOT NULL,
	"evidence" text
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"brand" text NOT NULL,
	"site" text,
	"fit_tag" text DEFAULT 'established' NOT NULL,
	"thesis_area" text,
	"what_it_is" text,
	"first_seen" timestamp with time zone,
	"last_seen" timestamp with time zone,
	CONSTRAINT "sponsors_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "trends" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"term" text NOT NULL,
	"headline" text NOT NULL,
	"why" text,
	"thesis_area" text,
	"momentum" text,
	"score" double precision DEFAULT 0 NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_kinds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"voice_count" integer DEFAULT 0 NOT NULL,
	"weekly" jsonb DEFAULT '[0,0,0,0]'::jsonb NOT NULL,
	"delta" integer DEFAULT 0 NOT NULL,
	"tracked" boolean DEFAULT false NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now(),
	"last_seen" timestamp with time zone DEFAULT now(),
	CONSTRAINT "trends_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "voices" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"grp" text,
	"youtube" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"feeds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"site" text,
	"image" text,
	"note" text,
	"status" text DEFAULT 'active' NOT NULL,
	"exempt" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 99 NOT NULL,
	"last_episode" timestamp with time zone,
	"seen_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "voices_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"item_type" text NOT NULL,
	"item_id" text NOT NULL,
	"visitor" text NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "votes_item_type_item_id_visitor_pk" PRIMARY KEY("item_type","item_id","visitor")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "alert_hits_url" ON "alert_hits" USING btree ("alert_id","url");--> statement-breakpoint
CREATE INDEX "companies_score_idx" ON "companies" USING btree ("score");--> statement-breakpoint
CREATE INDEX "companies_domain_idx" ON "companies" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX "fund_items_fund_url" ON "fund_items" USING btree ("fund_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "mentions_entity_url" ON "mentions" USING btree ("entity","url");--> statement-breakpoint
CREATE UNIQUE INDEX "person_items_url" ON "person_items" USING btree ("person_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "signals_company_url" ON "signals" USING btree ("company_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "sightings_sponsor_url" ON "sponsor_sightings" USING btree ("sponsor_id","url");