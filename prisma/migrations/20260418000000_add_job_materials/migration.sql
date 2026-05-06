-- CreateTable
CREATE TABLE "job_materials" (
    "id" TEXT NOT NULL,
    "production_job_id" TEXT NOT NULL,
    "material_stock_id" TEXT NOT NULL,
    "material_per_print_g" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_materials_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "cost_snapshots" ADD COLUMN "materials_detail" JSONB;

-- AddForeignKey
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_production_job_id_fkey" FOREIGN KEY ("production_job_id") REFERENCES "production_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_material_stock_id_fkey" FOREIGN KEY ("material_stock_id") REFERENCES "material_stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
