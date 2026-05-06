-- Move colors from material to stock; add rainbow flag

-- 1. Add is_rainbow to colors
ALTER TABLE "colors" ADD COLUMN "is_rainbow" BOOLEAN NOT NULL DEFAULT false;

-- 2. Add color columns to material_stocks (TEXT to match Prisma String without @db.Uuid)
ALTER TABLE "material_stocks" ADD COLUMN "color1_id" TEXT;
ALTER TABLE "material_stocks" ADD COLUMN "color2_id" TEXT;
ALTER TABLE "material_stocks" ADD COLUMN "color3_id" TEXT;

-- 3. Migrate existing material color_id → color1_id on all stocks of that material
UPDATE "material_stocks" ms
SET "color1_id" = m."color_id"
FROM "materials" m
WHERE ms."material_id" = m."id" AND m."color_id" IS NOT NULL;

-- 4. Drop color_id from materials
ALTER TABLE "materials" DROP COLUMN IF EXISTS "color_id";

-- 5. Foreign key constraints for stock colors
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_color1_id_fkey"
  FOREIGN KEY ("color1_id") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_color2_id_fkey"
  FOREIGN KEY ("color2_id") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_color3_id_fkey"
  FOREIGN KEY ("color3_id") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
