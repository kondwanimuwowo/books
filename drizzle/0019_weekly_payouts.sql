CREATE TYPE "public"."payout_kind" AS ENUM('per_order', 'weekly', 'instant');--> statement-breakpoint
ALTER TABLE "payouts" ALTER COLUMN "seller_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "kind" "payout_kind" DEFAULT 'per_order' NOT NULL;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "fee_ngwee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD COLUMN "payout_id" uuid;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payouts_seller_idx" ON "payouts" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "seller_orders_payout_idx" ON "seller_orders" USING btree ("payout_id");