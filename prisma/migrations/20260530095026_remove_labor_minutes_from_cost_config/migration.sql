/*
  Warnings:

  - You are about to drop the column `labor_minutes_per_job` on the `cost_configs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "cost_configs" DROP COLUMN "labor_minutes_per_job";
