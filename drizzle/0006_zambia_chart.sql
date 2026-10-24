CREATE TABLE "chart_entries" (
	"week" date NOT NULL,
	"rank" integer NOT NULL,
	"book_id" uuid NOT NULL,
	"buyers" integer NOT NULL,
	"score" numeric(8, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chart_entries_week_rank_pk" PRIMARY KEY("week","rank")
);
--> statement-breakpoint
ALTER TABLE "chart_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chart_entries" ADD CONSTRAINT "chart_entries_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chart_entries_week_book_key" ON "chart_entries" USING btree ("week","book_id");