CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"author_id" uuid,
	"seller_id" uuid,
	"publisher_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_one_target" CHECK (num_nonnulls("follows"."author_id", "follows"."seller_id", "follows"."publisher_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "follows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."publishers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "follows_profile_author_key" ON "follows" USING btree ("profile_id","author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_profile_seller_key" ON "follows" USING btree ("profile_id","seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_profile_publisher_key" ON "follows" USING btree ("profile_id","publisher_id");--> statement-breakpoint
CREATE INDEX "follows_author_idx" ON "follows" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "follows_seller_idx" ON "follows" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "follows_publisher_idx" ON "follows" USING btree ("publisher_id");