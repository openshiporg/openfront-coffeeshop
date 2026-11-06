-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'pending',
    "initialValue" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "purchaserName" TEXT NOT NULL DEFAULT '',
    "purchaserEmail" TEXT NOT NULL DEFAULT '',
    "recipientName" TEXT NOT NULL DEFAULT '',
    "recipientEmail" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "providerPaymentId" TEXT NOT NULL DEFAULT '',
    "refundedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "ledger" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_code_key" ON "GiftCard"("code");

-- CreateIndex
CREATE INDEX "GiftCard_store_idx" ON "GiftCard"("store");

-- CreateIndex
CREATE INDEX "GiftCard_providerPaymentId_idx" ON "GiftCard"("providerPaymentId");

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_store_fkey" FOREIGN KEY ("store") REFERENCES "StoreSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

