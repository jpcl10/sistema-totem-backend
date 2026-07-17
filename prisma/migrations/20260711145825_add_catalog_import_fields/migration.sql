/*
  Warnings:

  - A unique constraint covering the columns `[optionGroupId,key]` on the table `CatalogProductOption` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[productId,key]` on the table `CatalogProductOptionGroup` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `key` to the `CatalogProductOption` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key` to the `CatalogProductOptionGroup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CatalogCategory" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CatalogProduct" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CatalogProductOption" ADD COLUMN     "key" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CatalogProductOptionGroup" ADD COLUMN     "key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProductOption_optionGroupId_key_key" ON "CatalogProductOption"("optionGroupId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProductOptionGroup_productId_key_key" ON "CatalogProductOptionGroup"("productId", "key");
