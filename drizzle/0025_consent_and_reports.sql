CREATE TYPE "public"."report_reason" AS ENUM('copy', 'not_for_sale', 'misdescribed', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'removed', 'dismissed');--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"document" text NOT NULL,
	"version" text NOT NULL,
	"user_agent" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listing_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"reporter_id" uuid,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_reports" ADD CONSTRAINT "listing_reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consents_profile_idx" ON "consents" USING btree ("profile_id","accepted_at");--> statement-breakpoint
CREATE INDEX "listing_reports_status_idx" ON "listing_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_reports_once_key" ON "listing_reports" USING btree ("listing_id","reporter_id");--> statement-breakpoint
-- New accounts record the terms they accepted at sign-up (sent in the user's metadata).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  accepted text := NULLIF(NEW.raw_user_meta_data ->> 'terms_version', '');
BEGIN
  INSERT INTO public.profiles (id, email, display_name, terms_version, terms_accepted_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), split_part(NEW.email, '@', 1)),
    accepted,
    CASE WHEN accepted IS NULL THEN NULL ELSE now() END
  )
  ON CONFLICT (id) DO NOTHING;
  IF accepted IS NOT NULL THEN
    INSERT INTO public.consents (profile_id, document, version, user_agent)
    VALUES (NEW.id, 'terms', accepted, NULLIF(NEW.raw_user_meta_data ->> 'user_agent', ''));
  END IF;
  RETURN NEW;
END;
$$;
