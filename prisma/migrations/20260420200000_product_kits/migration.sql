-- Add isKit flag to products
ALTER TABLE "products" ADD COLUMN "is_kit" BOOLEAN NOT NULL DEFAULT false;

-- Create product_kit_items table
CREATE TABLE "product_kit_items" (
  "id"         TEXT NOT NULL,
  "kit_id"     TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "quantity"   INTEGER NOT NULL DEFAULT 1,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "product_kit_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_kit_items_kit_id_fkey"
    FOREIGN KEY ("kit_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_kit_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
