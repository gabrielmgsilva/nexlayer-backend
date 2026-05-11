/*
  Warnings:

  - You are about to drop the column `failure_auto_min_samples` on the `cost_configs` table. All the data in the column will be lost.
  - You are about to drop the column `failure_auto_window_days` on the `cost_configs` table. All the data in the column will be lost.
  - You are about to drop the column `failure_rate_mode` on the `cost_configs` table. All the data in the column will be lost.
  - You are about to drop the column `failure_rate_percent` on the `cost_configs` table. All the data in the column will be lost.
  - You are about to drop the column `color1_id` on the `material_stocks` table. All the data in the column will be lost.
  - You are about to drop the column `color2_id` on the `material_stocks` table. All the data in the column will be lost.
  - You are about to drop the column `color3_id` on the `material_stocks` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "material_stocks" DROP CONSTRAINT "material_stocks_color1_id_fkey";

-- DropForeignKey
ALTER TABLE "material_stocks" DROP CONSTRAINT "material_stocks_color2_id_fkey";

-- DropForeignKey
ALTER TABLE "material_stocks" DROP CONSTRAINT "material_stocks_color3_id_fkey";

-- DropForeignKey
ALTER TABLE "production_jobs" DROP CONSTRAINT "production_jobs_customer_id_fkey";

-- DropIndex
DROP INDEX "cost_configs_is_active_idx";

-- DropIndex
DROP INDEX "customers_cnpj_idx";

-- DropIndex
DROP INDEX "customers_cpf_idx";

-- DropIndex
DROP INDEX "customers_type_idx";

-- DropIndex
DROP INDEX "notifications_is_read_expires_at_idx";

-- DropIndex
DROP INDEX "product_channel_prices_channel_id_idx";

-- DropIndex
DROP INDEX "product_channel_prices_product_id_idx";

-- DropIndex
DROP INDEX "product_variations_product_id_idx";

-- DropIndex
DROP INDEX "sale_items_product_id_idx";

-- DropIndex
DROP INDEX "sale_items_production_job_id_idx";

-- DropIndex
DROP INDEX "sale_items_sale_order_id_idx";

-- DropIndex
DROP INDEX "sale_orders_channel_id_idx";

-- DropIndex
DROP INDEX "sale_orders_customer_id_idx";

-- DropIndex
DROP INDEX "sale_orders_status_idx";

-- AlterTable
ALTER TABLE "accessory_categories" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "brands" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "colors" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cost_configs" DROP COLUMN "failure_auto_min_samples",
DROP COLUMN "failure_auto_window_days",
DROP COLUMN "failure_rate_mode",
DROP COLUMN "failure_rate_percent";

-- AlterTable
ALTER TABLE "filament_types" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "material_stocks" DROP COLUMN "color1_id",
DROP COLUMN "color2_id",
DROP COLUMN "color3_id",
ADD COLUMN     "color_hex" TEXT,
ADD COLUMN     "color_is_incolor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "color_is_rainbow" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "failure_rate_percent" DECIMAL(5,2) DEFAULT 5;

-- AlterTable
ALTER TABLE "product_variations" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "units" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- DropEnum
DROP TYPE "FailureRateMode";

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
