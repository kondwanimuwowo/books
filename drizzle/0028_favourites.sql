CREATE TABLE "favourites" (
	"profile_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favourites_profile_id_book_id_pk" PRIMARY KEY("profile_id","book_id")
);
--> statement-breakpoint
ALTER TABLE "favourites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favourites_book_idx" ON "favourites" USING btree ("book_id");