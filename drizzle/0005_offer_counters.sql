CREATE TYPE "public"."offer_party" AS ENUM('buyer', 'seller');--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "counter_ngwee" integer;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "agreed_ngwee" integer;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "turn" "offer_party" DEFAULT 'seller' NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "counters" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "offers" SET "agreed_ngwee" = "amount_ngwee" WHERE "status" IN ('accepted', 'purchased');
