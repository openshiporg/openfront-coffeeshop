-- Preserve existing runtime records while replacing prohibited generic fixture labels.
UPDATE "CafeOrder"
SET
  "orderNumber" = 'NR-1001',
  "customerEmail" = 'mina@neighborhoodroast.local',
  "specialInstructions" = 'Neighborhood Roast opening reference order for queue and reporting checks.'
WHERE "orderNumber" = 'CF-DEMO-1001';

UPDATE "LoyaltyAccount"
SET
  "customerEmail" = 'mina@neighborhoodroast.local',
  "notes" = 'Neighborhood Roast opening loyalty balance.'
WHERE "customerEmail" = 'mina.demo@openfront.local';

UPDATE "LoyaltyEvent"
SET "note" = CASE
  WHEN "note" = 'Runtime demo opening balance' THEN 'Neighborhood Roast opening balance'
  WHEN "note" = 'Runtime demo order points' THEN 'Neighborhood Roast order points'
  ELSE "note"
END
WHERE "note" IN ('Runtime demo opening balance', 'Runtime demo order points');

UPDATE "InventoryItem"
SET "supplierName" = 'Neighborhood Roast Supply'
WHERE "supplierName" = 'Openfront Demo Supply';

UPDATE "Payment"
SET "providerPaymentId" = 'neighborhood_roast_1001'
WHERE "providerPaymentId" = 'demo_cf_1001';

UPDATE "PaymentProvider"
SET "metadata" = jsonb_build_object('configuredBy', 'onboarding')
WHERE "metadata" = jsonb_build_object('demo', true);
