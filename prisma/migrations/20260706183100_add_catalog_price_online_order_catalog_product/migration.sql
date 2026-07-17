/*
  Warnings:

  - Added the required column `priceInCents` to the `CatalogProduct` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CatalogProduct" ADD COLUMN     "priceInCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OnlineOrderItem" ADD COLUMN     "catalogProductId" TEXT;

-- CreateIndex
CREATE INDEX "OnlineOrderItem_catalogProductId_idx" ON "OnlineOrderItem"("catalogProductId");

-- AddForeignKey
ALTER TABLE "OnlineOrderItem" ADD CONSTRAINT "OnlineOrderItem_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
