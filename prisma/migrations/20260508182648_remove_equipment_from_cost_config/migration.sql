/*
  Warnings:

  - You are about to drop the column `equipment_id` on the `cost_configs` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "cost_configs" DROP CONSTRAINT "cost_configs_equipment_id_fkey";

-- AlterTable
ALTER TABLE "cost_configs" DROP COLUMN "equipment_id";
