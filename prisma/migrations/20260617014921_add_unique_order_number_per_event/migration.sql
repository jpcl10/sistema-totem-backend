/*
  Warnings:

  - A unique constraint covering the columns `[eventId,orderNumber]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Order_eventId_orderNumber_key" ON "Order"("eventId", "orderNumber");
