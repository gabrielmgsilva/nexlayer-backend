-- ── MaterialCategory enum ─────────────────────────────────────────────────────
CREATE TYPE "MaterialCategory" AS ENUM ('FILAMENT', 'RESIN');

-- ── FilamentType: add category ────────────────────────────────────────────────
ALTER TABLE "filament_types"
  ADD COLUMN "category" "MaterialCategory" NOT NULL DEFAULT 'FILAMENT';

-- ── Material: add materialType, rename/replace density, make fields optional ──
-- 1. Add material_type column
ALTER TABLE "materials"
  ADD COLUMN "material_type" "MaterialCategory" NOT NULL DEFAULT 'FILAMENT';

-- 2. Add new density column in kg/m³ (replacing density_g_cm3)
ALTER TABLE "materials"
  ADD COLUMN "density_kg_m3" DECIMAL(8,2);

-- 3. Migrate existing density values: g/cm³ → kg/m³ (multiply by 1000)
UPDATE "materials"
  SET "density_kg_m3" = "density_g_cm3" * 1000
  WHERE "density_g_cm3" IS NOT NULL;

-- 4. Drop old density column
ALTER TABLE "materials"
  DROP COLUMN IF EXISTS "density_g_cm3";

-- 5. Make diameter_mm optional (was NOT NULL)
ALTER TABLE "materials"
  ALTER COLUMN "diameter_mm" DROP NOT NULL;

-- 6. Make spool_weight_g optional (was NOT NULL)
ALTER TABLE "materials"
  ALTER COLUMN "spool_weight_g" DROP NOT NULL;
