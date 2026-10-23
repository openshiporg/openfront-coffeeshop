-- One-time backfill of the round-1 onboarding seed fixes for stores seeded before them.
-- Every statement only touches values the old seed wrote, so merchant edits are left alone.

-- Seeded inventory carries the seeded supplier's name.
UPDATE "InventoryItem" AS i SET "supplierName" = 'Common Thread Coffee Supply'
WHERE i."supplierName" = ''
  AND i."name" IN ('Espresso Beans', 'Whole Milk', 'Oat Milk', 'Vanilla Syrup', 'Cardamom Syrup', 'Almond Croissant', 'Cold Brew Concentrate', 'House Blend Beans')
  AND EXISTS (SELECT 1 FROM "Supplier" AS s WHERE s."store" = i."store" AND s."name" = 'Common Thread Coffee Supply');

UPDATE "InventoryItem" SET "category" = 'retail'
WHERE "name" = 'House Blend Beans' AND "sku" = 'COF-HOUSE-12' AND "category" = 'coffee';

-- Sample contact details: the operator's email replaces the .local address, and the fictional 555 number is cleared.
UPDATE "StoreSetting" SET "contactEmail" = COALESCE((
  SELECT u."email" FROM "User" AS u JOIN "Role" AS r ON r."id" = u."role"
  WHERE r."canManageSettings" = true AND u."email" <> ''
  ORDER BY u."createdAt" ASC LIMIT 1
), '')
WHERE "contactEmail" = 'hello@neighborhoodroast.local';

UPDATE "StoreSetting" SET "phone" = '' WHERE "phone" ~ '555[-. ]?01[0-9]{2}';

-- Seeded House Blend Beans gets the required Grind choice.
INSERT INTO "MenuItemModifier" ("id", "store", "name", "modifierGroup", "modifierGroupLabel", "required", "minSelections", "maxSelections", "priceAdjustment", "defaultSelected", "inStock", "menuItem", "inventoryAction", "inventoryQuantity", "createdAt", "updatedAt")
SELECT 'cgrind' || substr(md5(m."id" || g."name"), 1, 19), m."store", g."name", 'grind', 'Grind', true, 1, 1, 0, g."isDefault", true, m."id", 'none', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "MenuItem" AS m
CROSS JOIN (VALUES ('Whole bean', true), ('Drip', false), ('Espresso', false)) AS g("name", "isDefault")
WHERE m."name" = 'House Blend Beans' AND m."barStation" = 'retail_shelf'
  AND NOT EXISTS (SELECT 1 FROM "MenuItemModifier" AS x WHERE x."menuItem" = m."id" AND x."modifierGroup" = 'grind');
