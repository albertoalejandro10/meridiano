ALTER TABLE "transactions" ADD COLUMN "fee_of_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fee_of_id_transactions_id_fk" FOREIGN KEY ("fee_of_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_fee_of_id_idx" ON "transactions" USING btree ("fee_of_id");