-- Represent order-line and modifier ownership explicitly rather than only through
-- their parent relation. Existing rows inherit the already-validated parent store.
ALTER TABLE "OrderItem" ADD COLUMN "store" TEXT;
ALTER TABLE "MenuItemModifier" ADD COLUMN "store" TEXT;

-- Migration-only backfill changes ownership evidence, so suspend the existing
-- order-line evidence trigger for this statement and restore it immediately.
ALTER TABLE "OrderItem" DISABLE TRIGGER "OrderItem_evidence_guard";
UPDATE "OrderItem" AS item
SET "store" = parent."store"
FROM "CafeOrder" AS parent
WHERE item."order" = parent."id" AND item."store" IS NULL;
ALTER TABLE "OrderItem" ENABLE TRIGGER "OrderItem_evidence_guard";

UPDATE "MenuItemModifier" AS modifier
SET "store" = parent."store"
FROM "MenuItem" AS parent
WHERE modifier."menuItem" = parent."id" AND modifier."store" IS NULL;

ALTER TABLE "OrderItem" ALTER COLUMN "store" SET NOT NULL;
ALTER TABLE "MenuItemModifier" ALTER COLUMN "store" SET NOT NULL;

CREATE INDEX "OrderItem_store_idx" ON "OrderItem"("store");
CREATE INDEX "MenuItemModifier_store_idx" ON "MenuItemModifier"("store");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_store_fkey"
FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItemModifier" ADD CONSTRAINT "MenuItemModifier_store_fkey"
FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "OrderItem_store_immutable" BEFORE UPDATE ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION "prevent_coffee_store_reassignment"();
CREATE TRIGGER "MenuItemModifier_store_immutable" BEFORE UPDATE ON "MenuItemModifier"
FOR EACH ROW EXECUTE FUNCTION "prevent_coffee_store_reassignment"();

-- Child rows must belong to the same tenant as their aggregate parent.
CREATE FUNCTION "enforce_coffee_tenant_parent_consistency"() RETURNS trigger AS $$
DECLARE parent_store TEXT;
BEGIN
  IF TG_TABLE_NAME = 'OrderItem' THEN
    SELECT "store" INTO parent_store FROM "CafeOrder" WHERE id = NEW."order";
    IF parent_store IS NULL OR parent_store IS DISTINCT FROM NEW."store" THEN
      RAISE EXCEPTION 'OrderItem store must match its order';
    END IF;
    IF NEW."menuItem" IS NOT NULL THEN
      SELECT "store" INTO parent_store FROM "MenuItem" WHERE id = NEW."menuItem";
      IF parent_store IS NULL OR parent_store IS DISTINCT FROM NEW."store" THEN
        RAISE EXCEPTION 'OrderItem store must match its menu item';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'MenuItemModifier' THEN
    SELECT "store" INTO parent_store FROM "MenuItem" WHERE id = NEW."menuItem";
    IF parent_store IS NULL OR parent_store IS DISTINCT FROM NEW."store" THEN
      RAISE EXCEPTION 'MenuItemModifier store must match its menu item';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OrderItem_tenant_parent_guard" BEFORE INSERT OR UPDATE ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION "enforce_coffee_tenant_parent_consistency"();
CREATE TRIGGER "MenuItemModifier_tenant_parent_guard" BEFORE INSERT OR UPDATE ON "MenuItemModifier"
FOR EACH ROW EXECUTE FUNCTION "enforce_coffee_tenant_parent_consistency"();
