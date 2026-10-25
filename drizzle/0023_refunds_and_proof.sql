CREATE TYPE "public"."refund_reason" AS ENUM('not_shipped', 'dispute');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('processing', 'paid', 'failed', 'manual', 'done_manually');--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_order_id" uuid NOT NULL,
	"amount_ngwee" integer NOT NULL,
	"reason" "refund_reason" NOT NULL,
	"status" "refund_status" NOT NULL,
	"reference" text NOT NULL,
	"phone" text,
	"operator" "momo_operator",
	"lenco_reference" text,
	"failure_reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD COLUMN "proof_key" text;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD COLUMN "ship_reminder_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_seller_order_id_seller_orders_id_fk" FOREIGN KEY ("seller_order_id") REFERENCES "public"."seller_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_seller_order_key" ON "refunds" USING btree ("seller_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_reference_key" ON "refunds" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");