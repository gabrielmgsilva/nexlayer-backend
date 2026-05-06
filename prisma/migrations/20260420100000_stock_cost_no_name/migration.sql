-- Move costPerKg from material to stock; remove name from material

-- 1. Add cost_per_kg to material_stocks (default 0 for existing)
ALTER TABLE "material_stocks" ADD COLUMN "cost_per_kg" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 2. Copy current cost from material to each of its stocks
UPDATE "material_stocks" ms
SET "cost_per_kg" = m."cost_per_kg"
FROM "materials" m
WHERE ms."material_id" = m."id";

-- 3. Drop name and cost_per_kg from materials
ALTER TABLE "materials" DROP COLUMN "name";
ALTER TABLE "materials" DROP COLUMN "cost_per_kg";
