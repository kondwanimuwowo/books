CREATE TYPE "public"."delivery_band" AS ENUM('same_town', 'same_province', 'other_province');--> statement-breakpoint
CREATE TABLE "delivery_rates" (
	"method" "shipping_method" NOT NULL,
	"band" "delivery_band" NOT NULL,
	"fee_ngwee" integer NOT NULL,
	"extra_item_ngwee" integer DEFAULT 0 NOT NULL,
	"eta_min_days" integer NOT NULL,
	"eta_max_days" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_rates_method_band_pk" PRIMARY KEY("method","band")
);
--> statement-breakpoint
ALTER TABLE "delivery_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "delivery_methods" "shipping_method"[] DEFAULT '{courier,bus_parcel,zampost,collect}' NOT NULL;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "free_delivery_over_ngwee" integer;--> statement-breakpoint
INSERT INTO "delivery_rates" ("method", "band", "fee_ngwee", "extra_item_ngwee", "eta_min_days", "eta_max_days") VALUES
	('courier', 'same_town', 5000, 500, 1, 2),
	('collect', 'same_town', 0, 0, 0, 2),
	('bus_parcel', 'same_province', 6000, 1000, 1, 3),
	('bus_parcel', 'other_province', 9000, 1000, 2, 5),
	('zampost', 'same_province', 5000, 1000, 3, 7),
	('zampost', 'other_province', 7500, 1000, 5, 10)
ON CONFLICT DO NOTHING;