CREATE TABLE "ratings" (
	"seller_order_id" uuid NOT NULL,
	"rater" "offer_party" NOT NULL,
	"score" integer NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_seller_order_id_rater_pk" PRIMARY KEY("seller_order_id","rater"),
	CONSTRAINT "ratings_score_range" CHECK ("ratings"."score" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_seller_order_id_seller_orders_id_fk" FOREIGN KEY ("seller_order_id") REFERENCES "public"."seller_orders"("id") ON DELETE cascade ON UPDATE no action;