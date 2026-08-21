CREATE TYPE "public"."fee_kind" AS ENUM('INTERNAL', 'EXTERNAL');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "fee_kind" "fee_kind";--> statement-breakpoint
UPDATE "transactions" SET "fee_kind" = 'INTERNAL' WHERE "fee_of_id" IS NOT NULL AND "fee_kind" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_fee_of_id_kind_key" ON "transactions" USING btree ("fee_of_id","fee_kind");