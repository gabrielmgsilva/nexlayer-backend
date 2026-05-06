-- ──────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Product variations, stock control, and PRODUCT_LOW notification
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Add PRODUCT_LOW to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PRODUCT_LOW';

-- 2. Add stock fields to products
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "stock_quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "min_stock_alert" INTEGER;

-- 3. Create product_variations table
CREATE TABLE IF NOT EXISTS "product_variations" (
  "id"              TEXT        NOT NULL,
  "product_id"      TEXT        NOT NULL,
  "name"            TEXT        NOT NULL,
  "sku"             TEXT,
  "color_id"        TEXT,
  "photo_key"       TEXT,
  "photo_url"       TEXT,
  "model_file_key"  TEXT,
  "model_file_url"  TEXT,
  "model_format"    TEXT,
  "stock_quantity"  INTEGER     NOT NULL DEFAULT 0,
  "min_stock_alert" INTEGER,
  "is_active"       BOOLEAN     NOT NULL DEFAULT true,
  "sort_order"      INTEGER     NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "product_variations_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "product_variations_sku_key"   UNIQUE ("sku"),
  CONSTRAINT "product_variations_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_variations_color_id_fkey"
    FOREIGN KEY ("color_id")   REFERENCES "colors"("id")   ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "product_variations_product_id_idx"
  ON "product_variations" ("product_id");
