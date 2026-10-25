-- Pickup from the seller is offered for every town, not only the seller's own: the buyer travels, or sends someone.
-- Free, like pickup in town. Up to a week, since it depends on when the buyer (or their collector) can get there.
INSERT INTO "delivery_rates" ("method", "band", "fee_ngwee", "extra_item_ngwee", "eta_min_days", "eta_max_days")
VALUES ('collect', 'other_province', 0, 0, 1, 7)
ON CONFLICT ("method", "band") DO NOTHING;
