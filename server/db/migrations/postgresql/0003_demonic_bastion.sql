CREATE TABLE "goal_accounts" (
	"goal_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	CONSTRAINT "goal_accounts_goal_id_account_id_pk" PRIMARY KEY("goal_id","account_id")
);
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "goal_accounts" ADD CONSTRAINT "goal_accounts_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_accounts" ADD CONSTRAINT "goal_accounts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_accounts_account_id_idx" ON "goal_accounts" USING btree ("account_id");