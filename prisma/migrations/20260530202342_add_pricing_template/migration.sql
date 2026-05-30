-- AlterTable
ALTER TABLE "products" ADD COLUMN     "pricing_template_id" TEXT,
ADD COLUMN     "template_margin" DECIMAL(5,4);

-- CreateTable
CREATE TABLE "pricing_templates" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate_material_per_g" DECIMAL(12,8) NOT NULL,
    "rate_time_per_min" DECIMAL(12,8) NOT NULL,
    "base_accessory_cost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "failure_rate_applied" DECIMAL(5,2) NOT NULL,
    "default_margin" DECIMAL(5,4) NOT NULL DEFAULT 0.4,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_templates_product_id_key" ON "pricing_templates"("product_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_pricing_template_id_fkey" FOREIGN KEY ("pricing_template_id") REFERENCES "pricing_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_templates" ADD CONSTRAINT "pricing_templates_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_templates" ADD CONSTRAINT "pricing_templates_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "cost_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
