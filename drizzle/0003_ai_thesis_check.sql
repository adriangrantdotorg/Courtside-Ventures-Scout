ALTER TABLE "ai_usage" ADD COLUMN "checks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "thesis_check" jsonb;