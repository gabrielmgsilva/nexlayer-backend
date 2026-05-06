-- Add optional custom selling price per product variation
ALTER TABLE "product_variations"
ADD COLUMN "selling_price" DECIMAL(10,2);
