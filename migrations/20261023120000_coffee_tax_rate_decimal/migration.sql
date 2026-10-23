-- AlterTable
ALTER TABLE "StoreSetting" ALTER COLUMN "taxRateBasisPoints" SET DEFAULT 875,
ALTER COLUMN "taxRateBasisPoints" SET DATA TYPE DECIMAL(7,2);

-- The onboarding seed stored Brooklyn's 8.875% as 887 (8.87%); correct the seeded value.
UPDATE "StoreSetting" SET "taxRateBasisPoints" = 887.5 WHERE "taxRateBasisPoints" = 887;
