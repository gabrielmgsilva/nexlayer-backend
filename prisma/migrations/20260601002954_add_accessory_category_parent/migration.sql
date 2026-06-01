-- AlterTable
ALTER TABLE "accessory_categories" ADD COLUMN     "parent_id" TEXT;

-- AddForeignKey
ALTER TABLE "accessory_categories" ADD CONSTRAINT "accessory_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accessory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
