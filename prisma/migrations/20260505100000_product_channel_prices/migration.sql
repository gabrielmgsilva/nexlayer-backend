-- CreateTable
CREATE TABLE "product_channel_prices" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_channel_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_channel_prices_product_id_channel_id_key" ON "product_channel_prices"("product_id", "channel_id");

-- CreateIndex
CREATE INDEX "product_channel_prices_product_id_idx" ON "product_channel_prices"("product_id");
CREATE INDEX "product_channel_prices_channel_id_idx" ON "product_channel_prices"("channel_id");

-- AddForeignKey
ALTER TABLE "product_channel_prices" ADD CONSTRAINT "product_channel_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_channel_prices" ADD CONSTRAINT "product_channel_prices_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "sales_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
