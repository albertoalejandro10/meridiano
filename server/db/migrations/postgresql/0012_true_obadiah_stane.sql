CREATE TYPE "public"."recurring_occurrence_status" AS ENUM('PAID', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "recurring_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recurring_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"status" "recurring_occurrence_status" NOT NULL,
	"transaction_id" uuid,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_occurrences_recurring_id_due_date_key" UNIQUE("recurring_id","due_date")
);
--> statement-breakpoint
ALTER TABLE "recurring_transactions" ALTER COLUMN "amount" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_recurring_id_recurring_transactions_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."recurring_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_occurrences_user_id_due_date_idx" ON "recurring_occurrences" USING btree ("user_id","due_date");--> statement-breakpoint
ALTER TABLE "recurring_transactions" DROP COLUMN "last_run_date";