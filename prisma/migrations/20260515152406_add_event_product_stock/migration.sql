-- AlterTable
ALTER TABLE "EventProduct" ADD COLUMN     "soldOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stockQuantity" INTEGER,
ADD COLUMN     "trackStock" BOOLEAN NOT NULL DEFAULT false;
