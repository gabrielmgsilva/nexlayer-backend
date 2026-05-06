-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'PRINTING', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('PLA', 'ABS', 'PETG', 'TPU', 'PLA_CF', 'ASA', 'NYLON', 'OTHER');

-- CreateEnum
CREATE TYPE "MaterialStockStatus" AS ENUM ('SEALED', 'IN_USE', 'EMPTY', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MaterialTransactionType" AS ENUM ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'WASTE');

-- CreateEnum
CREATE TYPE "PurchaseMode" AS ENUM ('UNIT', 'PACK', 'BOX', 'ROLL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AccessoryTransactionType" AS ENUM ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "FailureRateMode" AS ENUM ('MANUAL', 'AUTO', 'HYBRID');

-- CreateEnum
CREATE TYPE "ProductionMode" AS ENUM ('SINGLE_PIECE', 'BATCH');

-- CreateEnum
CREATE TYPE "BatchStrategy" AS ENUM ('FULL_PRINTS', 'EXACT_QUANTITY');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUOTED', 'QUEUED', 'PRINTING', 'POST_PROCESSING', 'QUALITY_CHECK', 'PACKING', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrintAttemptStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "FailureCategory" AS ENUM ('ADHESION', 'CLOG', 'LAYER_SHIFT', 'STRINGING', 'WARPING', 'SPAGHETTI', 'UNDER_EXTRUSION', 'OVER_EXTRUSION', 'FILAMENT_BREAK', 'FILAMENT_TANGLE', 'POWER_LOSS', 'MECHANICAL', 'THERMAL', 'SUPPORT_FAIL', 'DIMENSIONAL', 'COSMETIC', 'OPERATOR_ERROR', 'SOFTWARE', 'OTHER');

-- CreateEnum
CREATE TYPE "FailureSeverity" AS ENUM ('TOTAL', 'PARTIAL', 'COSMETIC');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "fcm_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "cnpj_cpf" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serial_number" TEXT,
    "purchase_price" DECIMAL(10,2) NOT NULL,
    "purchase_date" DATE NOT NULL,
    "estimated_lifespan_hours" INTEGER NOT NULL,
    "rated_power_watts" INTEGER NOT NULL,
    "avg_power_watts" INTEGER NOT NULL,
    "build_volume_x" INTEGER,
    "build_volume_y" INTEGER,
    "build_volume_z" INTEGER,
    "max_speed_mm_s" INTEGER,
    "total_print_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "photo_url" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DECIMAL(10,2),
    "performed_at" DATE NOT NULL,
    "next_due_at" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "brand" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "diameter_mm" DECIMAL(4,2) NOT NULL,
    "density_g_cm3" DECIMAL(6,3),
    "spool_weight_g" INTEGER NOT NULL,
    "cost_per_kg" DECIMAL(10,2) NOT NULL,
    "supplier_id" TEXT,
    "recommended_temp_nozzle_min" INTEGER,
    "recommended_temp_nozzle_max" INTEGER,
    "recommended_temp_bed_min" INTEGER,
    "recommended_temp_bed_max" INTEGER,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_stocks" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "spool_label" TEXT,
    "initial_weight_g" INTEGER NOT NULL,
    "current_weight_g" INTEGER NOT NULL,
    "lot_number" TEXT,
    "purchase_date" DATE,
    "opened_date" DATE,
    "status" "MaterialStockStatus" NOT NULL DEFAULT 'SEALED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_stock_transactions" (
    "id" TEXT NOT NULL,
    "material_stock_id" TEXT NOT NULL,
    "type" "MaterialTransactionType" NOT NULL,
    "quantity_g" DECIMAL(10,2) NOT NULL,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "purchase_mode" "PurchaseMode" NOT NULL,
    "purchase_quantity" DECIMAL(10,3) NOT NULL,
    "purchase_cost" DECIMAL(10,2) NOT NULL,
    "cost_per_unit" DECIMAL(10,4) NOT NULL,
    "stock_quantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "min_stock_alert" DECIMAL(10,3),
    "supplier_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessory_price_histories" (
    "id" TEXT NOT NULL,
    "accessory_id" TEXT NOT NULL,
    "purchase_mode" "PurchaseMode" NOT NULL,
    "purchase_quantity" DECIMAL(10,3) NOT NULL,
    "purchase_cost" DECIMAL(10,2) NOT NULL,
    "cost_per_unit" DECIMAL(10,4) NOT NULL,
    "supplier_id" TEXT,
    "purchased_at" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accessory_price_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessory_transactions" (
    "id" TEXT NOT NULL,
    "accessory_id" TEXT NOT NULL,
    "type" "AccessoryTransactionType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "unit_cost" DECIMAL(10,4),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accessory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "category_id" TEXT NOT NULL,
    "estimated_print_time_minutes" INTEGER NOT NULL,
    "estimated_material_g" DECIMAL(10,2) NOT NULL,
    "pieces_per_print" INTEGER NOT NULL,
    "recommended_material_type" "MaterialType",
    "recommended_layer_height_mm" DECIMAL(4,2),
    "recommended_infill_percent" INTEGER,
    "supports_required" BOOLEAN,
    "default_accessories" JSONB NOT NULL DEFAULT '[]',
    "photos" JSONB NOT NULL DEFAULT '[]',
    "print_files" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "electricity_cost_per_kwh" DECIMAL(8,4) NOT NULL,
    "annual_maintenance_cost" DECIMAL(10,2) NOT NULL,
    "annual_usage_hours" INTEGER NOT NULL,
    "labor_cost_per_hour" DECIMAL(10,2),
    "labor_minutes_per_job" INTEGER,
    "monthly_overhead" DECIMAL(10,2),
    "monthly_production_hours" INTEGER,
    "failure_rate_mode" "FailureRateMode" NOT NULL DEFAULT 'MANUAL',
    "failure_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "failure_auto_window_days" INTEGER,
    "failure_auto_min_samples" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "cpf_cnpj" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_jobs" (
    "id" TEXT NOT NULL,
    "job_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "equipment_id" TEXT,
    "production_mode" "ProductionMode" NOT NULL,
    "quantity_ordered" INTEGER NOT NULL,
    "pieces_per_print" INTEGER NOT NULL,
    "prints_needed" INTEGER NOT NULL,
    "print_time_minutes" INTEGER NOT NULL,
    "material_per_print_g" DECIMAL(10,2) NOT NULL,
    "material_stock_id" TEXT,
    "job_accessories" JSONB NOT NULL DEFAULT '[]',
    "cost_config_id" TEXT NOT NULL,
    "profit_margin" DECIMAL(5,4) NOT NULL,
    "custom_unit_price" DECIMAL(10,2),
    "discount_percent" DECIMAL(5,2),
    "batch_strategy" "BatchStrategy" NOT NULL DEFAULT 'FULL_PRINTS',
    "total_pieces_produced" INTEGER,
    "extra_pieces_produced" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'QUOTED',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "quoted_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_attempts" (
    "id" TEXT NOT NULL,
    "production_job_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "PrintAttemptStatus" NOT NULL,
    "pieces_expected" INTEGER NOT NULL,
    "pieces_ok" INTEGER NOT NULL,
    "pieces_defective" INTEGER NOT NULL,
    "print_time_minutes" INTEGER,
    "material_used_g" DECIMAL(10,2),
    "material_wasted_g" DECIMAL(10,2),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_failures" (
    "id" TEXT NOT NULL,
    "print_attempt_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "product_id" TEXT,
    "material_id" TEXT,
    "failure_category" "FailureCategory" NOT NULL,
    "failure_severity" "FailureSeverity" NOT NULL,
    "material_wasted_g" DECIMAL(10,2) NOT NULL,
    "time_wasted_minutes" INTEGER NOT NULL,
    "accessories_wasted" JSONB,
    "reprint_required" BOOLEAN NOT NULL,
    "detected_at_layer" INTEGER,
    "detected_at_percent" INTEGER,
    "ambient_temp_c" DECIMAL(4,1),
    "humidity_percent" DECIMAL(4,1),
    "nozzle_hours" DECIMAL(8,2),
    "corrective_action" TEXT,
    "root_cause" TEXT,
    "photo_urls" JSONB,
    "notes" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_failures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_snapshots" (
    "id" TEXT NOT NULL,
    "production_job_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "production_mode" TEXT NOT NULL,
    "batch_strategy" TEXT,
    "equipment_name" TEXT NOT NULL,
    "equipment_power_watts" INTEGER NOT NULL,
    "print_time_minutes" INTEGER NOT NULL,
    "prints_count" INTEGER NOT NULL,
    "pieces_per_print" INTEGER NOT NULL,
    "quantity_ordered" INTEGER NOT NULL,
    "total_pieces_produced" INTEGER NOT NULL,
    "print_electricity_cost" DECIMAL(10,4) NOT NULL,
    "print_depreciation_cost" DECIMAL(10,4) NOT NULL,
    "print_maintenance_cost" DECIMAL(10,4) NOT NULL,
    "print_material_cost" DECIMAL(10,4) NOT NULL,
    "print_total_cost" DECIMAL(10,4) NOT NULL,
    "unit_electricity_cost" DECIMAL(10,4) NOT NULL,
    "unit_depreciation_cost" DECIMAL(10,4) NOT NULL,
    "unit_maintenance_cost" DECIMAL(10,4) NOT NULL,
    "unit_labor_cost" DECIMAL(10,4) NOT NULL,
    "unit_overhead_cost" DECIMAL(10,4) NOT NULL,
    "unit_material_cost" DECIMAL(10,4) NOT NULL,
    "material_name" TEXT NOT NULL,
    "material_cost_per_kg" DECIMAL(10,2) NOT NULL,
    "material_grams_per_print" DECIMAL(10,2) NOT NULL,
    "material_grams_per_unit" DECIMAL(10,4) NOT NULL,
    "unit_accessories_cost" DECIMAL(10,4) NOT NULL,
    "accessories_detail" JSONB NOT NULL,
    "failure_rate_mode" TEXT NOT NULL,
    "failure_rate_manual" DECIMAL(5,2) NOT NULL,
    "failure_rate_auto" DECIMAL(5,2),
    "failure_rate_applied" DECIMAL(5,2) NOT NULL,
    "failure_auto_samples" INTEGER,
    "failure_auto_window" INTEGER,
    "unit_failure_buffer_cost" DECIMAL(10,4) NOT NULL,
    "unit_cost_before_error" DECIMAL(10,4) NOT NULL,
    "unit_cost_with_error" DECIMAL(10,4) NOT NULL,
    "unit_sale_price" DECIMAL(10,2) NOT NULL,
    "unit_profit" DECIMAL(10,4) NOT NULL,
    "batch_total_cost" DECIMAL(10,2) NOT NULL,
    "batch_total_sale_price" DECIMAL(10,2) NOT NULL,
    "batch_total_profit" DECIMAL(10,2) NOT NULL,
    "profit_margin" DECIMAL(5,4) NOT NULL,
    "discount_percent" DECIMAL(5,2),
    "electricity_rate" DECIMAL(8,4) NOT NULL,
    "depreciation_rate_per_hour" DECIMAL(10,6) NOT NULL,
    "maintenance_rate_per_hour" DECIMAL(10,6) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "cost_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "production_jobs_job_number_key" ON "production_jobs"("job_number");

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_stock_transactions" ADD CONSTRAINT "material_stock_transactions_material_stock_id_fkey" FOREIGN KEY ("material_stock_id") REFERENCES "material_stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "accessories_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_price_histories" ADD CONSTRAINT "accessory_price_histories_accessory_id_fkey" FOREIGN KEY ("accessory_id") REFERENCES "accessories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_price_histories" ADD CONSTRAINT "accessory_price_histories_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessory_transactions" ADD CONSTRAINT "accessory_transactions_accessory_id_fkey" FOREIGN KEY ("accessory_id") REFERENCES "accessories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_material_stock_id_fkey" FOREIGN KEY ("material_stock_id") REFERENCES "material_stocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_cost_config_id_fkey" FOREIGN KEY ("cost_config_id") REFERENCES "cost_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_attempts" ADD CONSTRAINT "print_attempts_production_job_id_fkey" FOREIGN KEY ("production_job_id") REFERENCES "production_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_attempts" ADD CONSTRAINT "print_attempts_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_failures" ADD CONSTRAINT "print_failures_print_attempt_id_fkey" FOREIGN KEY ("print_attempt_id") REFERENCES "print_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_failures" ADD CONSTRAINT "print_failures_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_failures" ADD CONSTRAINT "print_failures_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_failures" ADD CONSTRAINT "print_failures_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_snapshots" ADD CONSTRAINT "cost_snapshots_production_job_id_fkey" FOREIGN KEY ("production_job_id") REFERENCES "production_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

