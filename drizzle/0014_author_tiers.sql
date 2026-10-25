CREATE TYPE "public"."author_tier" AS ENUM('copper', 'emerald', 'gold');--> statement-breakpoint
CREATE TABLE "author_milestones" (
	"author_id" uuid NOT NULL,
	"tier" "author_tier" NOT NULL,
	"readers" integer NOT NULL,
	"reached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone,
	CONSTRAINT "author_milestones_author_id_tier_pk" PRIMARY KEY("author_id","tier")
);
--> statement-breakpoint
ALTER TABLE "author_milestones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "authors" ADD COLUMN "links" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "author_milestones" ADD CONSTRAINT "author_milestones_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;