-- Backfill structured modifier snapshots from each historical order line's applied-modifier relationship.
UPDATE "OrderItem" AS order_item
SET "modifierSnapshot" = modifier_data.snapshot
FROM (
  SELECT
    applied."B" AS order_item_id,
    jsonb_agg(
      jsonb_build_object(
        'id', modifier."id",
        'name', modifier."name",
        'group', COALESCE(modifier."modifierGroup"::text, 'default'),
        'groupLabel', COALESCE(NULLIF(modifier."modifierGroupLabel", ''), modifier."modifierGroup"::text, 'Modifier'),
        'priceAdjustment', COALESCE(modifier."priceAdjustment", 0)
      )
      ORDER BY modifier."modifierGroup"::text, modifier."name"
    ) AS snapshot
  FROM "_OrderItem_appliedModifiers" AS applied
  JOIN "MenuItemModifier" AS modifier ON modifier."id" = applied."A"
  GROUP BY applied."B"
) AS modifier_data
WHERE order_item."id" = modifier_data.order_item_id
  AND COALESCE(order_item."modifierSnapshot", '[]'::jsonb) = '[]'::jsonb;
