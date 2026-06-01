/*
  Warnings:

  - You are about to drop the column `bed_temp_c` on the `slicer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `infill_percent` on the `slicer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `layer_height_mm` on the `slicer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `nozzle_temp_c` on the `slicer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `speed_mm_s` on the `slicer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `support_type` on the `slicer_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "slicer_profiles" DROP COLUMN "bed_temp_c",
DROP COLUMN "infill_percent",
DROP COLUMN "layer_height_mm",
DROP COLUMN "nozzle_temp_c",
DROP COLUMN "speed_mm_s",
DROP COLUMN "support_type",
ADD COLUMN     "params" JSONB NOT NULL DEFAULT '{}';
