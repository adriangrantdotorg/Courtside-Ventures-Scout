CREATE TABLE "feed_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"voice" text,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"date" timestamp with time zone,
	"text" text,
	"processed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "feed_items_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE INDEX "feed_items_date_idx" ON "feed_items" USING btree ("date");--> statement-breakpoint
CREATE INDEX "feed_items_kind_idx" ON "feed_items" USING btree ("kind");