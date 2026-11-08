-- Invariants the commands already promise, now held by the database too. Every constraint is
-- NOT VALID: new and updated rows are checked; production rows were verified clean before this
-- migration (2026-11-08), and NOT VALID keeps a row written mid-deploy from failing the deploy.
-- Names end in _check so features/keystone/lib/constraintRefusal.ts can turn them into sentences.

-- Money is never negative; a refund never exceeds what was paid; totals add up.
ALTER TABLE "CafeOrder" ADD CONSTRAINT "CafeOrder_money_nonnegative_check"
  CHECK (coalesce("subtotal",0) >= 0 AND coalesce("tax",0) >= 0 AND coalesce("tip",0) >= 0 AND coalesce("discount",0) >= 0 AND coalesce("total",0) >= 0) NOT VALID;
ALTER TABLE "CafeOrder" ADD CONSTRAINT "CafeOrder_total_sum_check"
  CHECK ("total" IS NULL OR "total" = coalesce("subtotal",0) + coalesce("tax",0) + coalesce("tip",0) - coalesce("discount",0)) NOT VALID;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive_check" CHECK ("quantity" > 0 AND "price" >= 0) NOT VALID;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refund_within_amount_check"
  CHECK ("amount" >= 0 AND coalesce("refundedAmount",0) >= 0 AND coalesce("refundedAmount",0) <= "amount") NOT VALID;
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_money_nonnegative_check"
  CHECK (coalesce("subtotalCents",0) >= 0 AND coalesce("taxCents",0) >= 0 AND coalesce("tipCents",0) >= 0 AND coalesce("totalCents",0) >= 0) NOT VALID;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_bounds_check"
  CHECK ("price" >= 0 AND coalesce("prepTimeMinutes",0) >= 0 AND coalesce("caffeineMg",0) >= 0 AND coalesce("calories",0) >= 0) NOT VALID;
ALTER TABLE "MenuItemModifier" ADD CONSTRAINT "MenuItemModifier_selection_check"
  CHECK (coalesce("minSelections",0) >= 0 AND coalesce("maxSelections",1) >= coalesce("minSelections",0) AND coalesce("inventoryQuantity",0) >= 0) NOT VALID;
ALTER TABLE "CateringOrder" ADD CONSTRAINT "CateringOrder_bounds_check"
  CHECK (coalesce("guestCount",0) >= 0 AND coalesce("subtotalCents",0) >= 0) NOT VALID;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_bounds_check" CHECK (coalesce("priceCents",0) >= 0) NOT VALID;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_window_check" CHECK ("renewsAt" IS NULL OR "startsAt" IS NULL OR "renewsAt" >= "startsAt") NOT VALID;

-- Gift card: balance between zero and what was loaded (refunds credit back, never above it).
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_balance_within_initial_check"
  CHECK ("initialValue" > 0 AND "balance" >= 0 AND "balance" <= "initialValue") NOT VALID;

-- Loyalty: rewards never go below zero (refund reversal refuses instead, loyaltyReversal.ts:19).
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_bounds_check"
  CHECK (coalesce("pointsBalance",0) >= 0 AND coalesce("lifetimePoints",0) >= 0 AND coalesce("drinkCredits",0) >= 0 AND coalesce("visits",0) >= 0) NOT VALID;

-- Register drawer: every running total non-negative, the expected drawer never below zero
-- (pay-outs are refused past available cash, registerShiftOperations.ts:146), close after open.
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_bounds_check"
  CHECK (coalesce("openingCashCents",0) >= 0 AND coalesce("cashSalesCents",0) >= 0 AND coalesce("cashRefundsCents",0) >= 0
     AND coalesce("cardSalesCents",0) >= 0 AND coalesce("cardRefundsCents",0) >= 0 AND coalesce("tipsCents",0) >= 0
     AND coalesce("payInsCents",0) >= 0 AND coalesce("payOutsCents",0) >= 0 AND coalesce("expectedCashCents",0) >= 0
     AND coalesce("countedCashCents",0) >= 0) NOT VALID;
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_window_check" CHECK ("closedAt" IS NULL OR "openedAt" IS NULL OR "closedAt" >= "openedAt") NOT VALID;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_amount_positive_check" CHECK ("amountCents" > 0) NOT VALID;

-- Stock: no negative on hand (sales, prep and waste refuse short stock under a lock); lots and
-- prep batches never hold more than was received or made; quantities that are amounts are positive.
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_stock_nonnegative_check"
  CHECK (coalesce("currentStock",0) >= 0 AND coalesce("reorderPoint",0) >= 0 AND coalesce("parLevel",0) >= 0 AND coalesce("costPerUnit",0) >= 0) NOT VALID;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_remaining_within_received_check"
  CHECK (coalesce("quantityReceived",0) >= 0 AND coalesce("quantityRemaining",0) >= 0 AND coalesce("quantityRemaining",0) <= coalesce("quantityReceived",0) AND coalesce("unitCostCents",0) >= 0) NOT VALID;
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_remaining_within_made_check"
  CHECK (coalesce("quantityMade",0) >= 0 AND coalesce("quantityRemaining",0) >= 0 AND coalesce("quantityRemaining",0) <= coalesce("quantityMade",0)) NOT VALID;
ALTER TABLE "PrepBatchConsumption" ADD CONSTRAINT "PrepBatchConsumption_quantity_positive_check" CHECK ("quantity" > 0) NOT VALID;
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_bounds_check" CHECK (coalesce("quantity",1) > 0 AND coalesce("costCents",0) >= 0) NOT VALID;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_bounds_check"
  CHECK (coalesce("orderedQuantity",1) > 0 AND coalesce("unitCostCents",0) >= 0 AND coalesce("subtotalCents",0) >= 0) NOT VALID;
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_quantity_positive_check" CHECK (coalesce("quantity",1) > 0) NOT VALID;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_yield_positive_check" CHECK (coalesce("yieldQuantity",1) > 0) NOT VALID;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_bounds_check" CHECK (coalesce("leadTimeDays",0) >= 0) NOT VALID;

-- Pickup settings within the limits the settings form enforces (store-settings-input.ts:14).
ALTER TABLE "StoreSetting" ADD CONSTRAINT "StoreSetting_pickup_bounds_check"
  CHECK (coalesce("pickupLeadTimeMinutes",5) BETWEEN 5 AND 240 AND coalesce("pickupWindowMinutes",5) BETWEEN 5 AND 120
     AND coalesce("pickupCapacityPerWindow",1) BETWEEN 1 AND 500) NOT VALID;

-- Staff shifts: end after start, clock-out after clock-in.
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_window_check"
  CHECK (("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt") AND ("clockOutAt" IS NULL OR "clockInAt" IS NULL OR "clockOutAt" >= "clockInAt")) NOT VALID;

-- One open register shift per store (the command checks under an advisory lock; this holds it for
-- every writer), and one person clocked in once: clocking in is locked per shift, not per person,
-- so two scheduled shifts for the same barista could both be clocked in.
CREATE UNIQUE INDEX "RegisterShift_one_open_per_store_key" ON "RegisterShift"("store") WHERE "status" = 'open';
CREATE UNIQUE INDEX "StaffShift_one_clocked_in_per_staff_key" ON "StaffShift"("staff") WHERE "status" = 'clocked_in' AND "staff" IS NOT NULL;
