CREATE TYPE "CatalogProductPricingRule" AS ENUM ('STANDARD', 'MAX_SELECTED_FLAVOR');

ALTER TABLE "CatalogProduct"
ADD COLUMN "pricingRule" "CatalogProductPricingRule" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "halfAndHalfFlavorCategoryId" TEXT;

ALTER TABLE "CatalogProduct"
ADD CONSTRAINT "CatalogProduct_halfAndHalfFlavorCategoryId_fkey"
FOREIGN KEY ("halfAndHalfFlavorCategoryId") REFERENCES "CatalogCategory"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OrderItemFlavor" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "catalogProductId" TEXT,
  "position" INTEGER NOT NULL,
  "flavorName" TEXT NOT NULL,
  "priceInCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderItemFlavor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnlineOrderItemFlavor" (
  "id" TEXT NOT NULL,
  "onlineOrderItemId" TEXT NOT NULL,
  "catalogProductId" TEXT,
  "position" INTEGER NOT NULL,
  "flavorName" TEXT NOT NULL,
  "priceInCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OnlineOrderItemFlavor_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderItemFlavor"
ADD CONSTRAINT "OrderItemFlavor_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderItemFlavor"
ADD CONSTRAINT "OrderItemFlavor_catalogProductId_fkey"
FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnlineOrderItemFlavor"
ADD CONSTRAINT "OnlineOrderItemFlavor_onlineOrderItemId_fkey"
FOREIGN KEY ("onlineOrderItemId") REFERENCES "OnlineOrderItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnlineOrderItemFlavor"
ADD CONSTRAINT "OnlineOrderItemFlavor_catalogProductId_fkey"
FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "OrderItemFlavor_orderItemId_position_key" ON "OrderItemFlavor"("orderItemId", "position");
CREATE INDEX "OrderItemFlavor_orderItemId_idx" ON "OrderItemFlavor"("orderItemId");
CREATE INDEX "OrderItemFlavor_catalogProductId_idx" ON "OrderItemFlavor"("catalogProductId");

CREATE UNIQUE INDEX "OnlineOrderItemFlavor_onlineOrderItemId_position_key" ON "OnlineOrderItemFlavor"("onlineOrderItemId", "position");
CREATE INDEX "OnlineOrderItemFlavor_onlineOrderItemId_idx" ON "OnlineOrderItemFlavor"("onlineOrderItemId");
CREATE INDEX "OnlineOrderItemFlavor_catalogProductId_idx" ON "OnlineOrderItemFlavor"("catalogProductId");

CREATE INDEX "CatalogProduct_halfAndHalfFlavorCategoryId_idx" ON "CatalogProduct"("halfAndHalfFlavorCategoryId");
