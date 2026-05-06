ALTER TABLE "cost_configs"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "cost_configs_is_active_idx" ON "cost_configs"("is_active");
