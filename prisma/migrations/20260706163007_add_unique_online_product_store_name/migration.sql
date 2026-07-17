/*
  Warnings:

  - A unique constraint covering the columns `[storeId,name]` on the table `OnlineCategory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[storeId,name]` on the table `OnlineProduct` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "OnlineCategory_storeId_name_key" ON "OnlineCategory"("storeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineProduct_storeId_name_key" ON "OnlineProduct"("storeId", "name");
