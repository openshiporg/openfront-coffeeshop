-- Backfill historical order-line media from the canonical menu media relationship.
UPDATE "OrderItem" AS order_item
SET "imagePathSnapshot" = COALESCE(primary_media."imagePath", menu_item."imageUrl", '')
FROM "MenuItem" AS menu_item
LEFT JOIN LATERAL (
  SELECT menu_item_image."imagePath"
  FROM "_MenuItem_menuItemImages" AS menu_media
  JOIN "MenuItemImage" AS menu_item_image ON menu_item_image."id" = menu_media."B"
  WHERE menu_media."A" = menu_item."id"
  ORDER BY menu_item_image."order" ASC NULLS LAST, menu_item_image."createdAt" ASC
  LIMIT 1
) AS primary_media ON TRUE
WHERE order_item."menuItem" = menu_item."id"
  AND COALESCE(order_item."imagePathSnapshot", '') = '';
