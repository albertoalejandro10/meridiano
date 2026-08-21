CREATE TABLE "long_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"priority" "task_priority" DEFAULT 'MEDIUM' NOT NULL,
	"target_date" date,
	"done" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "long_task_id" uuid;--> statement-breakpoint
ALTER TABLE "long_tasks" ADD CONSTRAINT "long_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "long_tasks" ADD CONSTRAINT "long_tasks_category_id_task_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."task_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "long_tasks_user_id_idx" ON "long_tasks" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_long_task_id_long_tasks_id_fk" FOREIGN KEY ("long_task_id") REFERENCES "public"."long_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_long_task_id_idx" ON "tasks" USING btree ("long_task_id");