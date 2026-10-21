-- Persist one reviewed storefront brand palette choice for the primary store.
-- Existing stores retain the current copper-roast presentation.
ALTER TABLE "StoreSetting"
ADD COLUMN "brandColor" TEXT NOT NULL DEFAULT 'copper';

ALTER TABLE "StoreSetting"
ADD CONSTRAINT "StoreSetting_brandColor_check"
CHECK ("brandColor" IN ('copper', 'amber', 'forest', 'ocean', 'violet', 'rose'));
