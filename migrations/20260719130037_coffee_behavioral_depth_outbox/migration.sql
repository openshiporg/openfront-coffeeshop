/*
  Warnings:

  - A unique constraint covering the columns `[refundIdempotencyKey]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `store` to the `CafeOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `CashMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `Ingredient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `InventoryItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `InventoryLot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `MenuCategory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `MenuItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `PaymentEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `PosOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `PrepBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `Recipe` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `RegisterShift` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `StaffShift` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `StockMovement` table without a default value. This is not possible if the table is not empty.
  - Made the column `inventoryItem` on table `StockMovement` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `store` to the `Supplier` table without a default value. This is not possible if the table is not empty.
  - Added the required column `store` to the `WasteLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_inventoryItem_fkey";

-- Add tenant columns as nullable, backfill from the canonical primary store, then
-- enforce non-null ownership. A populated database without a primary store fails
-- closed at SET NOT NULL rather than inventing ownership.
ALTER TABLE "CafeOrder" ADD COLUMN "store" TEXT;
ALTER TABLE "CashMovement" ADD COLUMN "store" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "store" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "store" TEXT;
ALTER TABLE "LoyaltyAccount" ADD COLUMN "store" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "store" TEXT;
ALTER TABLE "CateringOrder" ADD COLUMN "store" TEXT;
ALTER TABLE "InventoryLot" ADD COLUMN "store" TEXT;
ALTER TABLE "MenuCategory" ADD COLUMN "store" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "store" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Payment" ADD COLUMN "refundIdempotencyKey" TEXT,
  ADD COLUMN "refundReason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "refundedAmount" INTEGER DEFAULT 0,
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "store" TEXT;
ALTER TABLE "PaymentEvent" ADD COLUMN "store" TEXT;
ALTER TABLE "PosOrder" ADD COLUMN "store" TEXT;
ALTER TABLE "PrepBatch" ADD COLUMN "store" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "store" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "store" TEXT;
ALTER TABLE "RegisterShift" ADD COLUMN "store" TEXT;
ALTER TABLE "StaffShift" ADD COLUMN "store" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "inventoryLot" TEXT,
  ADD COLUMN "order" TEXT,
  ADD COLUMN "prepBatch" TEXT,
  ADD COLUMN "purchaseOrder" TEXT,
  ADD COLUMN "store" TEXT,
  ADD COLUMN "wasteLog" TEXT,
  ALTER COLUMN "inventoryItem" SET NOT NULL;
ALTER TABLE "Supplier" ADD COLUMN "store" TEXT;
ALTER TABLE "WasteLog" ADD COLUMN "store" TEXT;

DO $$
DECLARE
  primary_store TEXT;
  owned_table TEXT;
BEGIN
  SELECT "id" INTO primary_store FROM "StoreSetting" WHERE "singletonKey" = 'primary' LIMIT 1;
  FOREACH owned_table IN ARRAY ARRAY[
    'CafeOrder', 'CashMovement', 'CateringOrder', 'Ingredient', 'InventoryItem', 'InventoryLot',
    'LoyaltyAccount', 'MenuCategory', 'MenuItem', 'Payment', 'PaymentEvent', 'PosOrder',
    'PrepBatch', 'PurchaseOrder', 'Recipe', 'RegisterShift', 'StaffShift',
    'StockMovement', 'Subscription', 'Supplier', 'WasteLog'
  ] LOOP
    EXECUTE format('UPDATE %I SET "store" = $1 WHERE "store" IS NULL', owned_table) USING primary_store;
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "store" SET NOT NULL', owned_table);
  END LOOP;
END $$;

UPDATE "StaffShift" SET "idempotencyKey" = 'legacy-staff-shift:' || "id" WHERE "idempotencyKey" IS NULL;
ALTER TABLE "StaffShift" ALTER COLUMN "idempotencyKey" SET NOT NULL;
ALTER TABLE "StaffShift" ALTER COLUMN "idempotencyKey" SET DEFAULT '';

-- CreateTable
CREATE TABLE "CoffeeDomainEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "schemaVersion" TEXT NOT NULL DEFAULT '1',
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "payload" JSONB,
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "store" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoffeeDomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoffeeOutboxDelivery" (
    "id" TEXT NOT NULL,
    "deliveryKey" TEXT NOT NULL DEFAULT '',
    "consumer" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "nextAttempt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockOwner" TEXT NOT NULL DEFAULT '',
    "deliveredAt" TIMESTAMP(3),
    "deadLetteredAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "event" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoffeeOutboxDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoffeeDomainEvent_eventKey_key" ON "CoffeeDomainEvent"("eventKey");

-- CreateIndex
CREATE INDEX "CoffeeDomainEvent_eventType_idx" ON "CoffeeDomainEvent"("eventType");

-- CreateIndex
CREATE INDEX "CoffeeDomainEvent_aggregateType_idx" ON "CoffeeDomainEvent"("aggregateType");

-- CreateIndex
CREATE INDEX "CoffeeDomainEvent_aggregateId_idx" ON "CoffeeDomainEvent"("aggregateId");

-- CreateIndex
CREATE INDEX "CoffeeDomainEvent_store_idx" ON "CoffeeDomainEvent"("store");

-- CreateIndex
CREATE UNIQUE INDEX "CoffeeOutboxDelivery_deliveryKey_key" ON "CoffeeOutboxDelivery"("deliveryKey");

-- CreateIndex
CREATE INDEX "CoffeeOutboxDelivery_consumer_idx" ON "CoffeeOutboxDelivery"("consumer");

-- CreateIndex
CREATE INDEX "CoffeeOutboxDelivery_status_idx" ON "CoffeeOutboxDelivery"("status");

-- CreateIndex
CREATE INDEX "CoffeeOutboxDelivery_nextAttempt_idx" ON "CoffeeOutboxDelivery"("nextAttempt");

-- CreateIndex
CREATE INDEX "CoffeeOutboxDelivery_event_idx" ON "CoffeeOutboxDelivery"("event");

-- CreateIndex
CREATE INDEX "CoffeeOutboxDelivery_store_idx" ON "CoffeeOutboxDelivery"("store");

-- CreateIndex
CREATE INDEX "CafeOrder_store_idx" ON "CafeOrder"("store");

-- CreateIndex
CREATE INDEX "CashMovement_store_idx" ON "CashMovement"("store");

-- CreateIndex
CREATE INDEX "Ingredient_store_idx" ON "Ingredient"("store");

-- CreateIndex
CREATE INDEX "InventoryItem_store_idx" ON "InventoryItem"("store");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_store_idx" ON "LoyaltyAccount"("store");

-- CreateIndex
CREATE INDEX "Subscription_store_idx" ON "Subscription"("store");

-- CreateIndex
CREATE INDEX "CateringOrder_store_idx" ON "CateringOrder"("store");

-- CreateIndex
CREATE INDEX "InventoryLot_store_idx" ON "InventoryLot"("store");

-- CreateIndex
CREATE INDEX "MenuCategory_store_idx" ON "MenuCategory"("store");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_idempotencyKey_key" ON "MenuItem"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MenuItem_store_idx" ON "MenuItem"("store");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_refundIdempotencyKey_key" ON "Payment"("refundIdempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_store_idx" ON "Payment"("store");

-- CreateIndex
CREATE INDEX "PaymentEvent_store_idx" ON "PaymentEvent"("store");

-- CreateIndex
CREATE INDEX "PosOrder_store_idx" ON "PosOrder"("store");

-- CreateIndex
CREATE INDEX "PrepBatch_store_idx" ON "PrepBatch"("store");

-- CreateIndex
CREATE INDEX "PurchaseOrder_store_idx" ON "PurchaseOrder"("store");

-- CreateIndex
CREATE INDEX "Recipe_store_idx" ON "Recipe"("store");

-- CreateIndex
CREATE INDEX "RegisterShift_store_idx" ON "RegisterShift"("store");

-- CreateIndex
CREATE UNIQUE INDEX "StaffShift_idempotencyKey_key" ON "StaffShift"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StaffShift_store_idx" ON "StaffShift"("store");

-- CreateIndex
CREATE INDEX "StockMovement_store_idx" ON "StockMovement"("store");

-- CreateIndex
CREATE INDEX "StockMovement_order_idx" ON "StockMovement"("order");

-- CreateIndex
CREATE INDEX "StockMovement_purchaseOrder_idx" ON "StockMovement"("purchaseOrder");

-- CreateIndex
CREATE INDEX "StockMovement_inventoryLot_idx" ON "StockMovement"("inventoryLot");

-- CreateIndex
CREATE INDEX "StockMovement_prepBatch_idx" ON "StockMovement"("prepBatch");

-- CreateIndex
CREATE INDEX "StockMovement_wasteLog_idx" ON "StockMovement"("wasteLog");

-- CreateIndex
CREATE INDEX "Supplier_store_idx" ON "Supplier"("store");

-- CreateIndex
CREATE INDEX "WasteLog_store_idx" ON "WasteLog"("store");

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeOrder" ADD CONSTRAINT "CafeOrder_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CateringOrder" ADD CONSTRAINT "CateringOrder_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryItem_fkey" FOREIGN KEY ("inventoryItem") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_order_fkey" FOREIGN KEY ("order") REFERENCES "CafeOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseOrder_fkey" FOREIGN KEY ("purchaseOrder") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryLot_fkey" FOREIGN KEY ("inventoryLot") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_prepBatch_fkey" FOREIGN KEY ("prepBatch") REFERENCES "PrepBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_wasteLog_fkey" FOREIGN KEY ("wasteLog") REFERENCES "WasteLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoffeeDomainEvent" ADD CONSTRAINT "CoffeeDomainEvent_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoffeeOutboxDelivery" ADD CONSTRAINT "CoffeeOutboxDelivery_event_fkey" FOREIGN KEY ("event") REFERENCES "CoffeeDomainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoffeeOutboxDelivery" ADD CONSTRAINT "CoffeeOutboxDelivery_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant ownership may be assigned on insert/backfill but never reassigned.
CREATE FUNCTION "prevent_coffee_store_reassignment"() RETURNS trigger AS $$
BEGIN
  IF (to_jsonb(OLD) ->> 'store') IS DISTINCT FROM (to_jsonb(NEW) ->> 'store') THEN
    RAISE EXCEPTION 'Coffee aggregate store ownership is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE owned_table TEXT;
BEGIN
  FOREACH owned_table IN ARRAY ARRAY[
    'CafeOrder', 'CashMovement', 'CateringOrder', 'Ingredient', 'InventoryItem', 'InventoryLot',
    'LoyaltyAccount', 'MenuCategory', 'MenuItem', 'Payment', 'PaymentEvent', 'PosOrder',
    'PrepBatch', 'PurchaseOrder', 'Recipe', 'RegisterShift', 'StaffShift',
    'StockMovement', 'Subscription', 'Supplier', 'WasteLog', 'CoffeeDomainEvent', 'CoffeeOutboxDelivery'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION "prevent_coffee_store_reassignment"()',
      owned_table || '_store_immutable', owned_table
    );
  END LOOP;
END $$;

-- Append-only evidence cannot be rewritten even through a sudo/Prisma code path.
CREATE FUNCTION "prevent_coffee_append_only_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StockMovement_append_only" BEFORE UPDATE OR DELETE ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION "prevent_coffee_append_only_mutation"();
CREATE TRIGGER "PaymentEvent_append_only" BEFORE UPDATE OR DELETE ON "PaymentEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_coffee_append_only_mutation"();
CREATE TRIGGER "CoffeeDomainEvent_append_only" BEFORE UPDATE OR DELETE ON "CoffeeDomainEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_coffee_append_only_mutation"();

-- Order-line snapshots are immutable; only KDS lifecycle fields may advance.
CREATE FUNCTION "guard_coffee_order_item_evidence"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'OrderItem evidence cannot be deleted'; END IF;
  IF (to_jsonb(OLD) - ARRAY['barStatus','queuedAt','startedAt','readyAt','handedOffAt','updatedAt'])
     IS DISTINCT FROM
     (to_jsonb(NEW) - ARRAY['barStatus','queuedAt','startedAt','readyAt','handedOffAt','updatedAt']) THEN
    RAISE EXCEPTION 'OrderItem snapshot evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "OrderItem_evidence_guard" BEFORE UPDATE OR DELETE ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION "guard_coffee_order_item_evidence"();

-- Payment identity/amount evidence is immutable; controlled settlement/refund fields may change.
CREATE FUNCTION "guard_coffee_payment_evidence"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Payment evidence cannot be deleted'; END IF;
  IF (to_jsonb(OLD) - ARRAY['status','failureMessage','processedAt','refundIdempotencyKey','refundedAmount','refundReason','refundedAt','updatedAt'])
     IS DISTINCT FROM
     (to_jsonb(NEW) - ARRAY['status','failureMessage','processedAt','refundIdempotencyKey','refundedAmount','refundReason','refundedAt','updatedAt']) THEN
    RAISE EXCEPTION 'Payment identity and amount evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Payment_evidence_guard" BEFORE UPDATE OR DELETE ON "Payment"
FOR EACH ROW EXECUTE FUNCTION "guard_coffee_payment_evidence"();

-- Outbox delivery identity is immutable while lease/outcome state remains updateable.
CREATE FUNCTION "guard_coffee_outbox_delivery"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Outbox delivery evidence cannot be deleted'; END IF;
  IF OLD."deliveryKey" IS DISTINCT FROM NEW."deliveryKey"
     OR OLD."consumer" IS DISTINCT FROM NEW."consumer"
     OR OLD."event" IS DISTINCT FROM NEW."event"
     OR OLD."store" IS DISTINCT FROM NEW."store" THEN
    RAISE EXCEPTION 'Outbox delivery identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CoffeeOutboxDelivery_identity_guard" BEFORE UPDATE OR DELETE ON "CoffeeOutboxDelivery"
FOR EACH ROW EXECUTE FUNCTION "guard_coffee_outbox_delivery"();
