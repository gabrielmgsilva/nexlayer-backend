-- AlterTable
ALTER TABLE "cost_configs" ADD COLUMN     "failure_auto_min_samples" INTEGER,
ADD COLUMN     "failure_auto_window_days" INTEGER,
ADD COLUMN     "failure_rate_mode" TEXT NOT NULL DEFAULT 'HYBRID',
ADD COLUMN     "failure_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 5;
