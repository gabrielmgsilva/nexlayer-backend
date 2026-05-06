-- AlterTable: add weight and dimension fields to products
ALTER TABLE "products" ADD COLUMN "weight_g" INTEGER,
ADD COLUMN "width_mm" INTEGER,
ADD COLUMN "height_mm" INTEGER,
ADD COLUMN "depth_mm" INTEGER;
