-- AlterTable
ALTER TABLE "OnlineOrderItem" ADD COLUMN     "productId" TEXT;

-- CreateTable
CREATE TABLE "OnlineCategory" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineProduct" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "priceInCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogProductOptionGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minSelections" INTEGER NOT NULL DEFAULT 0,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogProductOptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogProductOption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "optionGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceDeltaInCents" INTEGER NOT NULL DEFAULT 0,
    "linkedProductId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemOption" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "optionGroupId" TEXT,
    "optionId" TEXT,
    "linkedProductId" TEXT,
    "groupName" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "priceDeltaInCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineOrderItemOption" (
    "id" TEXT NOT NULL,
    "onlineOrderItemId" TEXT NOT NULL,
    "optionGroupId" TEXT,
    "optionId" TEXT,
    "linkedProductId" TEXT,
    "groupName" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "priceDeltaInCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineOrderItemOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnlineCategory_storeId_idx" ON "OnlineCategory"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineCategory_storeId_slug_key" ON "OnlineCategory"("storeId", "slug");

-- CreateIndex
CREATE INDEX "OnlineProduct_storeId_idx" ON "OnlineProduct"("storeId");

-- CreateIndex
CREATE INDEX "OnlineProduct_categoryId_idx" ON "OnlineProduct"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineProduct_storeId_name_key" ON "OnlineProduct"("storeId", "name");

-- CreateIndex
CREATE INDEX "CatalogProductOptionGroup_organizationId_idx" ON "CatalogProductOptionGroup"("organizationId");

-- CreateIndex
CREATE INDEX "CatalogProductOptionGroup_productId_idx" ON "CatalogProductOptionGroup"("productId");

-- CreateIndex
CREATE INDEX "CatalogProductOption_organizationId_idx" ON "CatalogProductOption"("organizationId");

-- CreateIndex
CREATE INDEX "CatalogProductOption_optionGroupId_idx" ON "CatalogProductOption"("optionGroupId");

-- CreateIndex
CREATE INDEX "CatalogProductOption_linkedProductId_idx" ON "CatalogProductOption"("linkedProductId");

-- CreateIndex
CREATE INDEX "OrderItemOption_orderItemId_idx" ON "OrderItemOption"("orderItemId");

-- CreateIndex
CREATE INDEX "OnlineOrderItemOption_onlineOrderItemId_idx" ON "OnlineOrderItemOption"("onlineOrderItemId");

-- CreateIndex
CREATE INDEX "OnlineOrderItem_productId_idx" ON "OnlineOrderItem"("productId");

-- AddForeignKey
ALTER TABLE "OnlineCategory" ADD CONSTRAINT "OnlineCategory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "OnlineStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineProduct" ADD CONSTRAINT "OnlineProduct_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "OnlineStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineProduct" ADD CONSTRAINT "OnlineProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "OnlineCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineOrderItem" ADD CONSTRAINT "OnlineOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "OnlineProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogProductOptionGroup" ADD CONSTRAINT "CatalogProductOptionGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogProductOptionGroup" ADD CONSTRAINT "CatalogProductOptionGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogProductOption" ADD CONSTRAINT "CatalogProductOption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogProductOption" ADD CONSTRAINT "CatalogProductOption_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "CatalogProductOptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogProductOption" ADD CONSTRAINT "CatalogProductOption_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "CatalogProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemOption" ADD CONSTRAINT "OrderItemOption_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineOrderItemOption" ADD CONSTRAINT "OnlineOrderItemOption_onlineOrderItemId_fkey" FOREIGN KEY ("onlineOrderItemId") REFERENCES "OnlineOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
