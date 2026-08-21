ALTER TABLE "users" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "income" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "income_currency" "currency";