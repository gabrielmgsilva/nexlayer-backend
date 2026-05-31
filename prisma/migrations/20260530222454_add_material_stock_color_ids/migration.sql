-- AlterTable
ALTER TABLE "material_stocks" ADD COLUMN     "color1_id" TEXT,
ADD COLUMN     "color2_id" TEXT,
ADD COLUMN     "color3_id" TEXT;

-- AddForeignKey
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_color1_id_fkey" FOREIGN KEY ("color1_id") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_color2_id_fkey" FOREIGN KEY ("color2_id") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_stocks" ADD CONSTRAINT "material_stocks_color3_id_fkey" FOREIGN KEY ("color3_id") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
