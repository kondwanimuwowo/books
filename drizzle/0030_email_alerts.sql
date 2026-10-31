CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"profile_id" uuid,
	"first_name" text,
	"source" text NOT NULL,
	"token" text NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "favourites" ADD COLUMN "seen_price_ngwee" integer;--> statement-breakpoint
ALTER TABLE "follows" ADD COLUMN "seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "alerts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "alerts_token" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_email_key" ON "newsletter_subscribers" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_token_key" ON "newsletter_subscribers" USING btree ("token");--> statement-breakpoint
CREATE INDEX "newsletter_profile_idx" ON "newsletter_subscribers" USING btree ("profile_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_alerts_token_unique" UNIQUE("alerts_token");--> statement-breakpoint
-- Existing saves start from today's price, so the first digest doesn't report every one as news.
UPDATE "favourites" f SET "seen_price_ngwee" = (SELECT min(l."price_ngwee") FROM "listings" l WHERE l."book_id" = f."book_id" AND l."status" = 'active');
