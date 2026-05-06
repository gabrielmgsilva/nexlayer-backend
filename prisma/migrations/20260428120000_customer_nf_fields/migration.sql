-- ─────────────────────────────────────────────────────────────
-- Customer fiscal fields for NF-e / NFC-e
--   1) Add customer type (PF/PJ)
--   2) Split cpf_cnpj into cpf and cnpj
--   3) Add corporate and municipal registration fields
-- ─────────────────────────────────────────────────────────────

-- 1) Customer type enum
CREATE TYPE "CustomerType" AS ENUM ('PF', 'PJ');

-- 2) New fiscal columns
ALTER TABLE "customers"
  ADD COLUMN "type" "CustomerType" NOT NULL DEFAULT 'PF',
  ADD COLUMN "cpf" TEXT,
  ADD COLUMN "cnpj" TEXT,
  ADD COLUMN "razao_social" TEXT,
  ADD COLUMN "inscricao_municipal" TEXT;

-- 3) Backfill cpf/cnpj from legacy cpf_cnpj
UPDATE "customers"
SET "cpf" = regexp_replace("cpf_cnpj", '\\D', '', 'g')
WHERE "cpf_cnpj" IS NOT NULL
  AND regexp_replace("cpf_cnpj", '\\D', '', 'g') <> ''
  AND length(regexp_replace("cpf_cnpj", '\\D', '', 'g')) <= 11;

UPDATE "customers"
SET "cnpj" = regexp_replace("cpf_cnpj", '\\D', '', 'g'),
    "type" = 'PJ'
WHERE "cpf_cnpj" IS NOT NULL
  AND length(regexp_replace("cpf_cnpj", '\\D', '', 'g')) > 11;

-- 4) Remove deprecated column
ALTER TABLE "customers"
  DROP COLUMN "cpf_cnpj";

-- 5) Helpful indexes for lookup/invoicing workflows
CREATE INDEX "customers_type_idx" ON "customers"("type");
CREATE INDEX "customers_cpf_idx" ON "customers"("cpf");
CREATE INDEX "customers_cnpj_idx" ON "customers"("cnpj");
