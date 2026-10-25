-- Two delivery prices instead of three bands: in town (flat), and out of town (+K10 for each extra book).
-- Past orders keep the band and fee they were charged; only the price list changes.

-- In town: a flat fee, whatever the number of books.
UPDATE "delivery_rates" SET "fee_ngwee" = 5000, "extra_item_ngwee" = 0 WHERE "method" = 'yango' AND "band" = 'same_town';--> statement-breakpoint
UPDATE "delivery_rates" SET "extra_item_ngwee" = 0 WHERE "method" = 'mercury' AND "band" = 'same_town';--> statement-breakpoint

-- Out of town: K100 for the first book, K10 for each one after it. Mercury stays the premium option.
UPDATE "delivery_rates" SET "fee_ngwee" = 10000, "extra_item_ngwee" = 1000 WHERE "method" IN ('platinum', 'bus_parcel') AND "band" = 'other_province';--> statement-breakpoint
UPDATE "delivery_rates" SET "extra_item_ngwee" = 1000 WHERE "method" = 'mercury' AND "band" = 'other_province';--> statement-breakpoint

-- The middle band is no longer priced or offered.
DELETE FROM "delivery_rates" WHERE "band" = 'same_province';
