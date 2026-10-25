ALTER TABLE "seller_orders" ADD COLUMN "seller_response" text;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD COLUMN "seller_response_key" text;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD COLUMN "seller_responded_at" timestamp with time zone;