-- ──────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Normalize domain tables
-- Replaces free-text / enum fields with proper FK relations
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── 1. CREATE DOMAIN TABLES ─────────────────────────────────────────────────

CREATE TABLE "filament_types" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "sort_order"  INTEGER NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "filament_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "filament_types_name_key" UNIQUE ("name")
);

CREATE TABLE "colors" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "hex_code"  TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "colors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "colors_name_key" UNIQUE ("name")
);

CREATE TABLE "brands" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "website"   TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "brands_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "brands_name_key" UNIQUE ("name")
);

CREATE TABLE "accessory_categories" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "accessory_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "accessory_categories_name_key" UNIQUE ("name")
);

CREATE TABLE "units" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "symbol"    TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "units_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "units_name_key" UNIQUE ("name"),
    CONSTRAINT "units_symbol_key" UNIQUE ("symbol")
);

-- ─── 2. SEED DOMAIN TABLES ───────────────────────────────────────────────────

-- Filament types (replaces MaterialType enum)
INSERT INTO "filament_types" ("id", "name", "sort_order") VALUES
    (gen_random_uuid()::text, 'PLA',    1),
    (gen_random_uuid()::text, 'PETG',   2),
    (gen_random_uuid()::text, 'ABS',    3),
    (gen_random_uuid()::text, 'ASA',    4),
    (gen_random_uuid()::text, 'TPU',    5),
    (gen_random_uuid()::text, 'PLA-CF', 6),
    (gen_random_uuid()::text, 'NYLON',  7),
    (gen_random_uuid()::text, 'Outro',  99)
ON CONFLICT (name) DO NOTHING;

-- Common colors
INSERT INTO "colors" ("id", "name", "hex_code") VALUES
    (gen_random_uuid()::text, 'Branco',     '#FFFFFF'),
    (gen_random_uuid()::text, 'Preto',      '#000000'),
    (gen_random_uuid()::text, 'Cinza',      '#808080'),
    (gen_random_uuid()::text, 'Prata',      '#C0C0C0'),
    (gen_random_uuid()::text, 'Vermelho',   '#DC2626'),
    (gen_random_uuid()::text, 'Azul',       '#2563EB'),
    (gen_random_uuid()::text, 'Verde',      '#16A34A'),
    (gen_random_uuid()::text, 'Amarelo',    '#EAB308'),
    (gen_random_uuid()::text, 'Laranja',    '#EA580C'),
    (gen_random_uuid()::text, 'Rosa',       '#EC4899'),
    (gen_random_uuid()::text, 'Roxo',       '#9333EA'),
    (gen_random_uuid()::text, 'Marrom',     '#92400E'),
    (gen_random_uuid()::text, 'Natural',    '#F5F5DC'),
    (gen_random_uuid()::text, 'Transparente', NULL)
ON CONFLICT (name) DO NOTHING;

-- Common units
INSERT INTO "units" ("id", "name", "symbol") VALUES
    (gen_random_uuid()::text, 'Unidade',     'un'),
    (gen_random_uuid()::text, 'Par',         'par'),
    (gen_random_uuid()::text, 'Pacote',      'pct'),
    (gen_random_uuid()::text, 'Caixa',       'cx'),
    (gen_random_uuid()::text, 'Metro',       'm'),
    (gen_random_uuid()::text, 'Centímetro',  'cm'),
    (gen_random_uuid()::text, 'Milímetro',   'mm'),
    (gen_random_uuid()::text, 'Grama',       'g'),
    (gen_random_uuid()::text, 'Kilograma',   'kg'),
    (gen_random_uuid()::text, 'Mililitro',   'ml'),
    (gen_random_uuid()::text, 'Litro',       'l'),
    (gen_random_uuid()::text, 'Rolo',        'rolo')
ON CONFLICT (name) DO NOTHING;

-- ─── 3. ADD FK COLUMNS ───────────────────────────────────────────────────────

-- materials: type → filamentTypeId, brand → brandId, color → colorId
ALTER TABLE "materials"
    ADD COLUMN "filament_type_id" TEXT,
    ADD COLUMN "brand_id"         TEXT,
    ADD COLUMN "color_id"         TEXT;

-- equipment: brand → brandId
ALTER TABLE "equipment"
    ADD COLUMN "brand_id" TEXT;

-- accessories: category → categoryId, unit → unitId
ALTER TABLE "accessories"
    ADD COLUMN "category_id" TEXT,
    ADD COLUMN "unit_id"     TEXT;

-- products: recommendedMaterialType → recommendedFilamentTypeId
ALTER TABLE "products"
    ADD COLUMN "recommended_filament_type_id" TEXT;

-- ─── 4. DATA MIGRATION ───────────────────────────────────────────────────────

-- 4a. materials.filament_type_id — map old enum values
UPDATE "materials" m
SET "filament_type_id" = ft.id
FROM "filament_types" ft
WHERE ft.name = CASE m."type"::text
    WHEN 'PLA'    THEN 'PLA'
    WHEN 'ABS'    THEN 'ABS'
    WHEN 'PETG'   THEN 'PETG'
    WHEN 'TPU'    THEN 'TPU'
    WHEN 'PLA_CF' THEN 'PLA-CF'
    WHEN 'ASA'    THEN 'ASA'
    WHEN 'NYLON'  THEN 'NYLON'
    WHEN 'OTHER'  THEN 'Outro'
    ELSE NULL
END
AND m."type" IS NOT NULL;

-- 4b. products.recommended_filament_type_id
UPDATE "products" p
SET "recommended_filament_type_id" = ft.id
FROM "filament_types" ft
WHERE ft.name = CASE p."recommended_material_type"::text
    WHEN 'PLA'    THEN 'PLA'
    WHEN 'ABS'    THEN 'ABS'
    WHEN 'PETG'   THEN 'PETG'
    WHEN 'TPU'    THEN 'TPU'
    WHEN 'PLA_CF' THEN 'PLA-CF'
    WHEN 'ASA'    THEN 'ASA'
    WHEN 'NYLON'  THEN 'NYLON'
    WHEN 'OTHER'  THEN 'Outro'
    ELSE NULL
END
AND p."recommended_material_type" IS NOT NULL;

-- 4c. materials.brand_id — insert unique brands then FK
INSERT INTO "brands" ("id", "name")
SELECT gen_random_uuid()::text, sub.brand
FROM (SELECT DISTINCT TRIM(brand) AS brand FROM "materials" WHERE brand IS NOT NULL AND TRIM(brand) != '') sub
ON CONFLICT (name) DO NOTHING;

UPDATE "materials" m
SET "brand_id" = b.id
FROM "brands" b
WHERE LOWER(TRIM(b.name)) = LOWER(TRIM(m.brand)) AND m.brand IS NOT NULL AND TRIM(m.brand) != '';

-- 4d. equipment.brand_id — insert unique brands then FK
INSERT INTO "brands" ("id", "name")
SELECT gen_random_uuid()::text, sub.brand
FROM (SELECT DISTINCT TRIM(brand) AS brand FROM "equipment" WHERE brand IS NOT NULL AND TRIM(brand) != '') sub
ON CONFLICT (name) DO NOTHING;

UPDATE "equipment" e
SET "brand_id" = b.id
FROM "brands" b
WHERE LOWER(TRIM(b.name)) = LOWER(TRIM(e.brand)) AND e.brand IS NOT NULL AND TRIM(e.brand) != '';

-- 4e. materials.color_id — merge existing text colors with seed colors
INSERT INTO "colors" ("id", "name")
SELECT gen_random_uuid()::text, sub.color
FROM (SELECT DISTINCT TRIM(color) AS color FROM "materials" WHERE color IS NOT NULL AND TRIM(color) != '') sub
ON CONFLICT (name) DO NOTHING;

UPDATE "materials" m
SET "color_id" = c.id
FROM "colors" c
WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(m.color)) AND m.color IS NOT NULL AND TRIM(m.color) != '';

-- 4f. accessories.category_id — insert unique categories then FK
INSERT INTO "accessory_categories" ("id", "name")
SELECT gen_random_uuid()::text, sub.cat
FROM (SELECT DISTINCT TRIM(category) AS cat FROM "accessories" WHERE category IS NOT NULL AND TRIM(category) != '') sub
ON CONFLICT (name) DO NOTHING;

UPDATE "accessories" a
SET "category_id" = ac.id
FROM "accessory_categories" ac
WHERE LOWER(TRIM(ac.name)) = LOWER(TRIM(a.category)) AND a.category IS NOT NULL AND TRIM(a.category) != '';

-- 4g. accessories.unit_id — match by symbol first, then insert unknowns
UPDATE "accessories" a
SET "unit_id" = u.id
FROM "units" u
WHERE LOWER(TRIM(u.symbol)) = LOWER(TRIM(a.unit)) AND a.unit IS NOT NULL AND TRIM(a.unit) != '';

-- Insert unmatched units (where unit_id still null and unit is not empty)
INSERT INTO "units" ("id", "name", "symbol")
SELECT gen_random_uuid()::text, TRIM(a.unit), TRIM(a.unit)
FROM "accessories" a
WHERE a.unit IS NOT NULL AND TRIM(a.unit) != '' AND a."unit_id" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "units" u WHERE LOWER(u.symbol) = LOWER(TRIM(a.unit)))
ON CONFLICT (symbol) DO NOTHING;

-- Re-update for newly inserted units
UPDATE "accessories" a
SET "unit_id" = u.id
FROM "units" u
WHERE LOWER(TRIM(u.symbol)) = LOWER(TRIM(a.unit)) AND a."unit_id" IS NULL AND a.unit IS NOT NULL;

-- ─── 5. ADD FK CONSTRAINTS ───────────────────────────────────────────────────

ALTER TABLE "materials"
    ADD CONSTRAINT "materials_filament_type_id_fkey" FOREIGN KEY ("filament_type_id") REFERENCES "filament_types"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "materials_brand_id_fkey"         FOREIGN KEY ("brand_id")         REFERENCES "brands"("id")         ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "materials_color_id_fkey"         FOREIGN KEY ("color_id")         REFERENCES "colors"("id")         ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "equipment"
    ADD CONSTRAINT "equipment_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accessories"
    ADD CONSTRAINT "accessories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "accessory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "accessories_unit_id_fkey"     FOREIGN KEY ("unit_id")     REFERENCES "units"("id")               ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products"
    ADD CONSTRAINT "products_recommended_filament_type_id_fkey" FOREIGN KEY ("recommended_filament_type_id") REFERENCES "filament_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 6. DROP OLD COLUMNS ─────────────────────────────────────────────────────

ALTER TABLE "materials"  DROP COLUMN "type",     DROP COLUMN "brand",    DROP COLUMN "color";
ALTER TABLE "equipment"  DROP COLUMN "brand";
ALTER TABLE "accessories" DROP COLUMN "category", DROP COLUMN "unit";
ALTER TABLE "products"   DROP COLUMN "recommended_material_type";

-- ─── 7. DROP MaterialType ENUM ────────────────────────────────────────────────

DROP TYPE IF EXISTS "MaterialType";
