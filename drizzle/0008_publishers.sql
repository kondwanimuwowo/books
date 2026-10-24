CREATE TABLE "publishers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"website" text,
	"is_zambian" boolean DEFAULT false NOT NULL,
	"verified_seller_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publishers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "publisher_id" uuid;--> statement-breakpoint
ALTER TABLE "publishers" ADD CONSTRAINT "publishers_verified_seller_id_sellers_id_fk" FOREIGN KEY ("verified_seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publishers_slug_key" ON "publishers" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_publisher_idx" ON "books" USING btree ("publisher_id");--> statement-breakpoint
-- Backfill: one publisher per distinct name already on books (same slug rule as slugify in src/lib/utils.ts).
INSERT INTO "publishers" ("slug", "name")
SELECT DISTINCT ON (slug) slug, name
FROM (
	SELECT trim("publisher") AS name, left(trim(both '-' from regexp_replace(lower(trim("publisher")), '[^a-z0-9]+', '-', 'g')), 80) AS slug
	FROM "books"
	WHERE "publisher" IS NOT NULL
) named
WHERE slug <> ''
ORDER BY slug, name
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
UPDATE "books" b
SET "publisher_id" = p."id"
FROM "publishers" p
WHERE b."publisher" IS NOT NULL
	AND p."slug" = left(trim(both '-' from regexp_replace(lower(trim(b."publisher")), '[^a-z0-9]+', '-', 'g')), 80);
