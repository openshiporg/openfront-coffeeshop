/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `StockMovement` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MenuItemModifier" ADD COLUMN     "inventoryAction" TEXT DEFAULT 'unreviewed',
ADD COLUMN     "inventoryItem" TEXT,
ADD COLUMN     "inventoryQuantity" DECIMAL(18,4) DEFAULT 0,
ADD COLUMN     "replacesInventoryItem" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "refundRegisterShift" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE INDEX "MenuItemModifier_inventoryItem_idx" ON "MenuItemModifier"("inventoryItem");

-- CreateIndex
CREATE INDEX "MenuItemModifier_replacesInventoryItem_idx" ON "MenuItemModifier"("replacesInventoryItem");

-- CreateIndex
CREATE INDEX "Payment_refundRegisterShift_idx" ON "Payment"("refundRegisterShift");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_idempotencyKey_key" ON "StockMovement"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "MenuItemModifier" ADD CONSTRAINT "MenuItemModifier_inventoryItem_fkey" FOREIGN KEY ("inventoryItem") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemModifier" ADD CONSTRAINT "MenuItemModifier_replacesInventoryItem_fkey" FOREIGN KEY ("replacesInventoryItem") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundRegisterShift_fkey" FOREIGN KEY ("refundRegisterShift") REFERENCES "RegisterShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Refund payout destination is appended once as part of the controlled refund lifecycle.
CREATE OR REPLACE FUNCTION "guard_coffee_payment_evidence"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Payment evidence cannot be deleted'; END IF;
  IF (to_jsonb(OLD) - ARRAY['status','providerPaymentId','failureMessage','processedAt','refundIdempotencyKey','refundedAmount','refundReason','refundedAt','refundRegisterShift','updatedAt'])
     IS DISTINCT FROM
     (to_jsonb(NEW) - ARRAY['status','providerPaymentId','failureMessage','processedAt','refundIdempotencyKey','refundedAmount','refundReason','refundedAt','refundRegisterShift','updatedAt']) THEN
    RAISE EXCEPTION 'Payment identity and amount evidence is immutable';
  END IF;
  IF OLD."providerPaymentId" IS DISTINCT FROM NEW."providerPaymentId"
     AND NOT (COALESCE(OLD."providerPaymentId", '') = '' AND COALESCE(NEW."providerPaymentId", '') <> '') THEN
    RAISE EXCEPTION 'Payment provider reference is immutable once assigned';
  END IF;
  IF OLD."refundRegisterShift" IS DISTINCT FROM NEW."refundRegisterShift"
     AND NOT (OLD."refundRegisterShift" IS NULL AND NEW."refundRegisterShift" IS NOT NULL AND NEW."status" = 'refunded') THEN
    RAISE EXCEPTION 'Payment refund register is immutable once assigned';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
