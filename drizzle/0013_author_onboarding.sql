CREATE TYPE "public"."verification_status" AS ENUM('pending', 'approved', 'rejected', 'needs_more');--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"author_id" uuid,
	"legal_name" text NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"reviewer_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_requests_seller_idx" ON "verification_requests" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "verification_requests_status_idx" ON "verification_requests" USING btree ("status");