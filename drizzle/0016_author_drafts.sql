CREATE TABLE "author_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid,
	"name" text NOT NULL,
	"is_zambian" boolean DEFAULT true NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"books" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"invite" jsonb,
	"invite_token_hash" text,
	"invited_at" timestamp with time zone,
	"opted_out_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "author_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "author_drafts" ADD CONSTRAINT "author_drafts_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_drafts" ADD CONSTRAINT "author_drafts_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "author_drafts_author_key" ON "author_drafts" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "author_drafts_token_key" ON "author_drafts" USING btree ("invite_token_hash");