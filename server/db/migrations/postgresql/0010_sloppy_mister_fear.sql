CREATE TYPE "public"."task_priority" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TABLE "task_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_categories_user_id_name_key" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"priority" "task_priority" DEFAULT 'MEDIUM' NOT NULL,
	"month" text NOT NULL,
	"due_date" date,
	"done" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"carried_from_month" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_categories" ADD CONSTRAINT "task_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_task_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."task_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_categories_user_id_idx" ON "task_categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_user_id_month_idx" ON "tasks" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "tasks_category_id_idx" ON "tasks" USING btree ("category_id");