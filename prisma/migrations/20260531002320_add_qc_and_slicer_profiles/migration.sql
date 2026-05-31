-- CreateEnum
CREATE TYPE "QcOutcome" AS ENUM ('APPROVED', 'PARTIAL_APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "qc_inspections" (
    "id" TEXT NOT NULL,
    "production_job_id" TEXT NOT NULL,
    "qty_approved" INTEGER NOT NULL,
    "qty_rejected" INTEGER NOT NULL DEFAULT 0,
    "outcome" "QcOutcome" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slicer_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "material_id" TEXT,
    "equipment_id" TEXT,
    "nozzle_temp_c" INTEGER,
    "bed_temp_c" INTEGER,
    "speed_mm_s" INTEGER,
    "layer_height_mm" DECIMAL(4,2),
    "infill_percent" INTEGER,
    "support_type" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slicer_profiles_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_production_job_id_fkey" FOREIGN KEY ("production_job_id") REFERENCES "production_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slicer_profiles" ADD CONSTRAINT "slicer_profiles_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slicer_profiles" ADD CONSTRAINT "slicer_profiles_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
