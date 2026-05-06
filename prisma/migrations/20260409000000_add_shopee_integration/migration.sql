-- AlterTable: products
ALTER TABLE "products" ADD COLUMN "ncm" TEXT,
ADD COLUMN "cfop" TEXT,
ADD COLUMN "origem" INTEGER DEFAULT 0,
ADD COLUMN "shopee_item_id" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "products_shopee_item_id_key" ON "products"("shopee_item_id");

-- AlterTable: customers
ALTER TABLE "customers" ADD COLUMN "street" TEXT,
ADD COLUMN "address_number" TEXT,
ADD COLUMN "complement" TEXT,
ADD COLUMN "neighborhood" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "state" CHAR(2),
ADD COLUMN "zip_code" TEXT,
ADD COLUMN "ibge_code" TEXT,
ADD COLUMN "ie_destinatario" TEXT;

-- AlterTable: sale_orders
ALTER TABLE "sale_orders" ADD COLUMN "shopee_order_sn" TEXT,
ADD COLUMN "tracking_number" TEXT,
ADD COLUMN "shipping_carrier" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sale_orders_shopee_order_sn_key" ON "sale_orders"("shopee_order_sn");

-- CreateTable: integration_configs
CREATE TABLE "integration_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_provider_key_key" ON "integration_configs"("provider", "key");

-- CreateTable: shopee_order_mappings
CREATE TABLE "shopee_order_mappings" (
    "id" TEXT NOT NULL,
    "shopee_order_sn" TEXT NOT NULL,
    "sale_order_id" TEXT NOT NULL,
    "shopee_status" TEXT NOT NULL,
    "raw_payload" JSONB,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopee_order_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopee_order_mappings_shopee_order_sn_key" ON "shopee_order_mappings"("shopee_order_sn");

-- CreateIndex
CREATE UNIQUE INDEX "shopee_order_mappings_sale_order_id_key" ON "shopee_order_mappings"("sale_order_id");

-- AddForeignKey
ALTER TABLE "shopee_order_mappings" ADD CONSTRAINT "shopee_order_mappings_sale_order_id_fkey" FOREIGN KEY ("sale_order_id") REFERENCES "sale_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: shopee_product_mappings
CREATE TABLE "shopee_product_mappings" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "shopee_item_id" BIGINT NOT NULL,
    "shopee_model_id" BIGINT,
    "shopee_category_id" BIGINT,
    "shopee_status" TEXT NOT NULL DEFAULT 'NORMAL',
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopee_product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopee_product_mappings_product_id_key" ON "shopee_product_mappings"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "shopee_product_mappings_shopee_item_id_key" ON "shopee_product_mappings"("shopee_item_id");

-- AddForeignKey
ALTER TABLE "shopee_product_mappings" ADD CONSTRAINT "shopee_product_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
