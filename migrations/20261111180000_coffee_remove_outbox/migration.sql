-- Remove the outbox. Nothing delivers from it; external events go through Commerce webhooks only.
DROP TABLE "CoffeeOutboxDelivery";
DROP FUNCTION IF EXISTS "guard_coffee_outbox_delivery"();

-- CoffeeDomainEvent stays only as the command idempotency ledger (replay receipts); rename it to say so.
ALTER TABLE "CoffeeDomainEvent" RENAME TO "CoffeeCommandReceipt";
ALTER TABLE "CoffeeCommandReceipt" RENAME CONSTRAINT "CoffeeDomainEvent_pkey" TO "CoffeeCommandReceipt_pkey";
ALTER TABLE "CoffeeCommandReceipt" RENAME CONSTRAINT "CoffeeDomainEvent_store_fkey" TO "CoffeeCommandReceipt_store_fkey";
ALTER INDEX "CoffeeDomainEvent_eventKey_key" RENAME TO "CoffeeCommandReceipt_eventKey_key";
ALTER INDEX "CoffeeDomainEvent_eventType_idx" RENAME TO "CoffeeCommandReceipt_eventType_idx";
ALTER INDEX "CoffeeDomainEvent_aggregateType_idx" RENAME TO "CoffeeCommandReceipt_aggregateType_idx";
ALTER INDEX "CoffeeDomainEvent_aggregateId_idx" RENAME TO "CoffeeCommandReceipt_aggregateId_idx";
ALTER INDEX "CoffeeDomainEvent_store_idx" RENAME TO "CoffeeCommandReceipt_store_idx";
ALTER TRIGGER "CoffeeDomainEvent_append_only" ON "CoffeeCommandReceipt" RENAME TO "CoffeeCommandReceipt_append_only";
