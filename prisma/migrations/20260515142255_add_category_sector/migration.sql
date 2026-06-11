/*
  Warnings:

  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CategorySector" AS ENUM ('BAR', 'KITCHEN');

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_eventId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_eventId_fkey";

-- AlterTable
ALTER TABLE "CatalogCategory" ADD COLUMN     "sector" "CategorySector" NOT NULL DEFAULT 'KITCHEN';

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "Product";
