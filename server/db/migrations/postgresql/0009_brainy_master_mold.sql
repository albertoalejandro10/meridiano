CREATE TABLE "account_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"stated_balance" numeric(14, 2) NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_reconciliations" ADD CONSTRAINT "account_reconciliations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_reconciliations" ADD CONSTRAINT "account_reconciliations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_reconciliations_user_id_idx" ON "account_reconciliations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_reconciliations_account_id_date_idx" ON "account_reconciliations" USING btree ("account_id","date");