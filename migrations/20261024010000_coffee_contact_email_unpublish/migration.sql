-- The seed backfill copied a staff sign-in email into the public store contact.
-- Clear any contact that is a staff login; Store Settings asks the merchant for one on the next save.
UPDATE "StoreSetting" AS s SET "contactEmail" = ''
WHERE s."contactEmail" <> ''
  AND EXISTS (SELECT 1 FROM "User" AS u WHERE u."role" IS NOT NULL AND lower(u."email") = lower(s."contactEmail"));
