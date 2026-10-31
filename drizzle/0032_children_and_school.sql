ALTER TABLE "books" ADD COLUMN "age_bands" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "levels" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "curriculum" text;--> statement-breakpoint
CREATE INDEX "books_age_bands_idx" ON "books" USING gin ("age_bands");--> statement-breakpoint
CREATE INDEX "books_levels_idx" ON "books" USING gin ("levels");