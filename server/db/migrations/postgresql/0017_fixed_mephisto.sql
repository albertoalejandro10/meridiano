CREATE TYPE "public"."employment_type" AS ENUM('EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER', 'BUSINESS_OWNER');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('SINGLE', 'PARTNERED', 'MARRIED');--> statement-breakpoint
CREATE TYPE "public"."risk_tolerance" AS ENUM('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "employment_type" "employment_type";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "marital_status" "marital_status";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dependents" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "risk_tolerance" "risk_tolerance";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "financial_notes" text;