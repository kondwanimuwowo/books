-- Runs after 0010 has committed: Postgres can't use enum values added in the same transaction.
ALTER TABLE "sellers" ALTER COLUMN "delivery_methods" SET DEFAULT '{yango,platinum,mercury,bus_parcel,collect}';--> statement-breakpoint
-- Starting prices from the midpoints of what these couriers charge for a book today; edit them in admin.
DELETE FROM "delivery_rates" WHERE "method" IN ('courier', 'zampost');--> statement-breakpoint
INSERT INTO "delivery_rates" ("method", "band", "fee_ngwee", "extra_item_ngwee", "eta_min_days", "eta_max_days") VALUES
	('yango', 'same_town', 3500, 500, 0, 1),
	('mercury', 'same_town', 7000, 1000, 1, 1),
	('mercury', 'same_province', 10000, 1000, 1, 2),
	('mercury', 'other_province', 15000, 1000, 1, 3),
	('platinum', 'same_province', 6500, 1000, 2, 4),
	('platinum', 'other_province', 8500, 1000, 2, 5)
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Sellers keep their choices: the town courier becomes Yango and Mercury, Zampost becomes Platinum.
UPDATE "sellers" SET "delivery_methods" = (
	SELECT array_agg(DISTINCT m ORDER BY m)
	FROM unnest(
		array_remove(array_remove("delivery_methods", 'courier'), 'zampost')
		|| CASE WHEN 'courier' = ANY("delivery_methods") THEN '{yango,mercury}'::"shipping_method"[] ELSE '{}'::"shipping_method"[] END
		|| CASE WHEN 'zampost' = ANY("delivery_methods") THEN '{platinum}'::"shipping_method"[] ELSE '{}'::"shipping_method"[] END
	) AS m
)
WHERE 'courier' = ANY("delivery_methods") OR 'zampost' = ANY("delivery_methods");
