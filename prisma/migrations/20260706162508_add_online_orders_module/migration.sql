-- CreateEnum
CREATE TYPE "ModuleKey" AS ENUM ('ONLINE_ORDERS', 'TOTEM', 'EVENTS', 'PAYMENTS', 'PRINTING', 'NFC_CASHLESS', 'FINANCIAL', 'DEVICES', 'REPORTS', 'DELIVERY', 'WHATSAPP', 'LOYALTY');

-- CreateEnum
CREATE TYPE "OnlineOrderPaymentMethod" AS ENUM ('PIX', 'CARD_ON_DELIVERY', 'CASH');

-- CreateEnum
CREATE TYPE "OnlineOrderStatus" AS ENUM ('RECEIVED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "OrganizationModule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "moduleKey" "ModuleKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineStore" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineStore_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "OnlineOrder" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryNumber" TEXT NOT NULL,
    "deliveryNeighborhood" TEXT NOT NULL,
    "deliveryComplement" TEXT,
    "deliveryReference" TEXT,
    "paymentMethod" "OnlineOrderPaymentMethod" NOT NULL,
    "changeForInCents" INTEGER,
    "subtotalInCents" INTEGER NOT NULL,
    "deliveryFeeInCents" INTEGER NOT NULL DEFAULT 0,
    "totalInCents" INTEGER NOT NULL,
    "status" "OnlineOrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceInCents" INTEGER NOT NULL,
    "totalInCents" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationModule_organizationId_idx" ON "OrganizationModule"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationModule_moduleKey_idx" ON "OrganizationModule"("moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationModule_organizationId_moduleKey_key" ON "OrganizationModule"("organizationId", "moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineStore_slug_key" ON "OnlineStore"("slug");

-- CreateIndex
CREATE INDEX "OnlineStore_organizationId_idx" ON "OnlineStore"("organizationId");

-- CreateIndex
CREATE INDEX "OnlineStore_slug_idx" ON "OnlineStore"("slug");

-- CreateIndex
CREATE INDEX "OnlineCategory_storeId_idx" ON "OnlineCategory"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineCategory_storeId_slug_key" ON "OnlineCategory"("storeId", "slug");

-- CreateIndex
CREATE INDEX "OnlineProduct_storeId_idx" ON "OnlineProduct"("storeId");

-- CreateIndex
CREATE INDEX "OnlineProduct_categoryId_idx" ON "OnlineProduct"("categoryId");

-- CreateIndex
CREATE INDEX "OnlineOrder_storeId_idx" ON "OnlineOrder"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlineOrder_storeId_orderNumber_key" ON "OnlineOrder"("storeId", "orderNumber");

-- CreateIndex
CREATE INDEX "OnlineOrderItem_orderId_idx" ON "OnlineOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OnlineOrderItem_productId_idx" ON "OnlineOrderItem"("productId");

-- AddForeignKey
ALTER TABLE "OrganizationModule" ADD CONSTRAINT "OrganizationModule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineStore" ADD CONSTRAINT "OnlineStore_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineCategory" ADD CONSTRAINT "OnlineCategory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "OnlineStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineProduct" ADD CONSTRAINT "OnlineProduct_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "OnlineStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineProduct" ADD CONSTRAINT "OnlineProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "OnlineCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineOrder" ADD CONSTRAINT "OnlineOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "OnlineStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineOrderItem" ADD CONSTRAINT "OnlineOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OnlineOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlineOrderItem" ADD CONSTRAINT "OnlineOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "OnlineProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
