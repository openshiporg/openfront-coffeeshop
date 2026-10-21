/*
  Review note: MenuItemModifier.idempotencyKey is nullable, so the unique index
  preserves all existing modifiers while enforcing uniqueness for new keyed writes.
  Existing implicit many-to-many primary keys are intentionally retained.
*/
-- AlterTable
ALTER TABLE "MenuItemModifier" ADD COLUMN     "idempotencyKey" TEXT;

-- Persist one non-null store tax authority. Existing rows receive the bounded default.
ALTER TABLE "StoreSetting" ADD COLUMN "taxRateBasisPoints" INTEGER NOT NULL DEFAULT 875;
ALTER TABLE "StoreSetting" ADD CONSTRAINT "StoreSetting_taxRateBasisPoints_check"
CHECK ("taxRateBasisPoints" BETWEEN 0 AND 10000);

-- CreateTable
CREATE TABLE "PrepBatchConsumption" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "store" TEXT NOT NULL,
    "prepBatch" TEXT NOT NULL,
    "order" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepBatchConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrepBatchConsumption_idempotencyKey_key" ON "PrepBatchConsumption"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PrepBatchConsumption_store_idx" ON "PrepBatchConsumption"("store");

-- CreateIndex
CREATE INDEX "PrepBatchConsumption_prepBatch_idx" ON "PrepBatchConsumption"("prepBatch");

-- CreateIndex
CREATE INDEX "PrepBatchConsumption_order_idx" ON "PrepBatchConsumption"("order");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemModifier_idempotencyKey_key" ON "MenuItemModifier"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "PrepBatchConsumption" ADD CONSTRAINT "PrepBatchConsumption_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatchConsumption" ADD CONSTRAINT "PrepBatchConsumption_prepBatch_fkey" FOREIGN KEY ("prepBatch") REFERENCES "PrepBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatchConsumption" ADD CONSTRAINT "PrepBatchConsumption_order_fkey" FOREIGN KEY ("order") REFERENCES "CafeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Consumption rows are signed append-only evidence: positive consumes a prepared
-- batch, negative releases the exact prior reservation during pre-production cancel.
ALTER TABLE "PrepBatchConsumption" ADD CONSTRAINT "PrepBatchConsumption_quantity_nonzero"
CHECK ("quantity" <> 0);
ALTER TABLE "PrepBatchConsumption" ADD CONSTRAINT "PrepBatchConsumption_idempotency_nonempty"
CHECK (length("idempotencyKey") > 0);
CREATE TRIGGER "PrepBatchConsumption_store_immutable" BEFORE UPDATE ON "PrepBatchConsumption"
FOR EACH ROW EXECUTE FUNCTION "prevent_coffee_store_reassignment"();
CREATE TRIGGER "PrepBatchConsumption_append_only" BEFORE UPDATE OR DELETE ON "PrepBatchConsumption"
FOR EACH ROW EXECUTE FUNCTION "prevent_coffee_append_only_mutation"();

CREATE FUNCTION "enforce_prep_batch_consumption_tenant"() RETURNS trigger AS $$
DECLARE prep_store TEXT; order_store TEXT;
BEGIN
  SELECT "store" INTO prep_store FROM "PrepBatch" WHERE "id" = NEW."prepBatch";
  SELECT "store" INTO order_store FROM "CafeOrder" WHERE "id" = NEW."order";
  IF prep_store IS NULL OR order_store IS NULL
     OR prep_store IS DISTINCT FROM NEW."store"
     OR order_store IS DISTINCT FROM NEW."store" THEN
    RAISE EXCEPTION 'PrepBatchConsumption store must match prep batch and order';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PrepBatchConsumption_tenant_parent_guard"
BEFORE INSERT ON "PrepBatchConsumption"
FOR EACH ROW EXECUTE FUNCTION "enforce_prep_batch_consumption_tenant"();
