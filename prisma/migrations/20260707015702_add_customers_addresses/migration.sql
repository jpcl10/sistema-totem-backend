/*
  Warnings:

  - You are about to drop the column `productId` on the `OnlineOrderItem` table. All the data in the column will be lost.
  - You are about to drop the `OnlineCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OnlineProduct` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "OnlineCategory" DROP CONSTRAINT "OnlineCategory_storeId_fkey";

-- DropForeignKey
ALTER TABLE "OnlineOrderItem" DROP CONSTRAINT "OnlineOrderItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "OnlineProduct" DROP CONSTRAINT "OnlineProduct_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "OnlineProduct" DROP CONSTRAINT "OnlineProduct_storeId_fkey";

-- DropIndex
DROP INDEX "OnlineOrderItem_productId_idx";

-- AlterTable
ALTER TABLE "CatalogProduct" ALTER COLUMN "priceInCents" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OnlineOrder" ADD COLUMN     "customerAddressId" TEXT,
ADD COLUMN     "customerId" TEXT;

-- AlterTable
ALTER TABLE "OnlineOrderItem" DROP COLUMN "productId";

-- DropTable
DROP TABLE "OnlineCategory";

-- DropTable
DROP TABLE "OnlineProduct";

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT,
    "complement" TEXT,
    "reference" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_phone_key" ON "Customer"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");

-- CreateIndex
CREATE INDEX "OnlineOrder_customerId_idx" ON "OnlineOrder"("customerId");

-- CreateIndex
CREATE INDEX "OnlineOrder_customerAddressId_idx" ON "OnlineOrder"("customerAddressId");

-- AddForeignKey
ALTER TABLE "OnlineOrder" ADD CONSTRAINT "OnlineOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineOrder" ADD CONSTRAINT "OnlineOrder_customerAddressId_fkey" FOREIGN KEY ("customerAddressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
