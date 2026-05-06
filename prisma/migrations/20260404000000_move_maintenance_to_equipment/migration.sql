-- Move annual_maintenance_cost and annual_usage_hours from cost_configs to equipment

-- 1. Add columns to equipment
ALTER TABLE "equipment"
  ADD COLUMN "annual_maintenance_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "annual_usage_hours"      INTEGER       NOT NULL DEFAULT 1500;

-- 2. Add equipment_id FK to cost_configs
ALTER TABLE "cost_configs"
  ADD COLUMN "equipment_id" TEXT;

ALTER TABLE "cost_configs"
  ADD CONSTRAINT "cost_configs_equipment_id_fkey"
  FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Drop old columns from cost_configs
ALTER TABLE "cost_configs"
  DROP COLUMN "annual_maintenance_cost",
  DROP COLUMN "annual_usage_hours";
