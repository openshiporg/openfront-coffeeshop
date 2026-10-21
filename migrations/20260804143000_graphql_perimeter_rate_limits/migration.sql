-- Durable, shared fixed-window counters for the application-owned GraphQL perimeter.
-- This table contains hashed network/principal bucket keys only; it is not domain evidence.
CREATE TABLE "GraphQLRateLimitBucket" (
  "bucketKey" TEXT NOT NULL,
  "windowStart" TIMESTAMPTZ NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "costUnits" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "GraphQLRateLimitBucket_pkey" PRIMARY KEY ("bucketKey", "windowStart"),
  CONSTRAINT "GraphQLRateLimitBucket_requestCount_nonnegative" CHECK ("requestCount" >= 0),
  CONSTRAINT "GraphQLRateLimitBucket_costUnits_nonnegative" CHECK ("costUnits" >= 0)
);

CREATE INDEX "GraphQLRateLimitBucket_expiresAt_idx" ON "GraphQLRateLimitBucket" ("expiresAt");
