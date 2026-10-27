ALTER TABLE "companies" ADD COLUMN "media" jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "rounds" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "total_raised" double precision;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "not_startup" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "keep" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "merged_into" integer;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "enriched_at" timestamp with time zone;