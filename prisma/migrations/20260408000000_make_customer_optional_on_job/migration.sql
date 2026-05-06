-- AlterTable: make customer_id optional on production_jobs
ALTER TABLE "production_jobs" ALTER COLUMN "customer_id" DROP NOT NULL;
