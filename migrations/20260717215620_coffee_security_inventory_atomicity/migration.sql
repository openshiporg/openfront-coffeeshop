/*
  Warnings:

  - You are about to drop the column `capturePaymentFunction` on the `PaymentProvider` table. All the data in the column will be lost.
  - You are about to drop the column `createPaymentFunction` on the `PaymentProvider` table. All the data in the column will be lost.
  - You are about to drop the column `credentials` on the `PaymentProvider` table. All the data in the column will be lost.
  - You are about to drop the column `generatePaymentLinkFunction` on the `PaymentProvider` table. All the data in the column will be lost.
  - You are about to drop the column `getPaymentStatusFunction` on the `PaymentProvider` table. All the data in the column will be lost.
  - You are about to drop the column `handleWebhookFunction` on the `PaymentProvider` table. All the data in the column will be lost.
  - You are about to drop the column `refundPaymentFunction` on the `PaymentProvider` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `PrepBatch` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `PurchaseOrder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `WasteLog` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "InventoryLot" ADD COLUMN     "purchaseOrder" TEXT;

-- AlterTable
ALTER TABLE "PaymentProvider" DROP COLUMN "capturePaymentFunction",
DROP COLUMN "createPaymentFunction",
DROP COLUMN "credentials",
DROP COLUMN "generatePaymentLinkFunction",
DROP COLUMN "getPaymentStatusFunction",
DROP COLUMN "handleWebhookFunction",
DROP COLUMN "refundPaymentFunction",
ALTER COLUMN "isInstalled" SET DEFAULT false;

-- AlterTable
ALTER TABLE "PrepBatch" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "quantityRemaining" DECIMAL(18,4) DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'completed';

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "inventoryItem" TEXT,
ADD COLUMN     "orderedQuantity" DECIMAL(18,4) DEFAULT 0,
ADD COLUMN     "unitCostCents" INTEGER DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'submitted';

-- AlterTable
ALTER TABLE "StoreSetting" ADD COLUMN     "pickupCapacityPerWindow" INTEGER DEFAULT 20,
ADD COLUMN     "pickupWindowMinutes" INTEGER DEFAULT 15;

-- AlterTable
ALTER TABLE "WasteLog" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "replayKey" TEXT NOT NULL DEFAULT '',
    "providerCode" TEXT NOT NULL DEFAULT '',
    "providerEventId" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "order" TEXT,
    "payment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_replayKey_key" ON "PaymentEvent"("replayKey");

-- CreateIndex
CREATE INDEX "PaymentEvent_order_idx" ON "PaymentEvent"("order");

-- CreateIndex
CREATE INDEX "PaymentEvent_payment_idx" ON "PaymentEvent"("payment");

-- CreateIndex
CREATE INDEX "InventoryLot_purchaseOrder_idx" ON "InventoryLot"("purchaseOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PrepBatch_idempotencyKey_key" ON "PrepBatch"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_idempotencyKey_key" ON "PurchaseOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PurchaseOrder_inventoryItem_idx" ON "PurchaseOrder"("inventoryItem");

-- CreateIndex
CREATE UNIQUE INDEX "WasteLog_idempotencyKey_key" ON "WasteLog"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_order_fkey" FOREIGN KEY ("order") REFERENCES "CafeOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_payment_fkey" FOREIGN KEY ("payment") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_inventoryItem_fkey" FOREIGN KEY ("inventoryItem") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_purchaseOrder_fkey" FOREIGN KEY ("purchaseOrder") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
