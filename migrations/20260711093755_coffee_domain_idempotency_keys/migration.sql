/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `CafeOrder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CafeOrder" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "requestFingerprint" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CafeOrder_idempotencyKey_key" ON "CafeOrder"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
