-- ─────────────────────────────────────────────────────────────
-- NEXLAYER feature pack
--   1) Production queue position for kanban / scheduling
--   2) SalesChannel fees (fixed + variable) for accurate P&L
--   3) User onboarding flag for first-time setup wizard
-- ─────────────────────────────────────────────────────────────

-- 1) ProductionJob.queuePosition
ALTER TABLE "production_jobs"
  ADD COLUMN "queue_position" INTEGER;

CREATE INDEX "production_jobs_equipment_id_queue_position_idx"
  ON "production_jobs" ("equipment_id", "queue_position");

-- 2) SalesChannel additional fees
ALTER TABLE "sales_channels"
  ADD COLUMN "fee_fixed" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "fee_percent_variable" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- 3) User onboarding completion timestamp
ALTER TABLE "users"
  ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

-- Backfill: any existing user is considered onboarded
UPDATE "users" SET "onboarding_completed_at" = NOW() WHERE "onboarding_completed_at" IS NULL;
