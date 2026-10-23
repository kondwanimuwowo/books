ALTER TYPE "public"."payout_status" ADD VALUE 'refunded';--> statement-breakpoint
ALTER TYPE "public"."seller_order_status" ADD VALUE 'refunded';--> statement-breakpoint
ALTER TABLE "seller_orders" ADD COLUMN "dispute_note" text;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD COLUMN "disputed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD COLUMN "resolution_note" text;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD COLUMN "resolved_at" timestamp with time zone;