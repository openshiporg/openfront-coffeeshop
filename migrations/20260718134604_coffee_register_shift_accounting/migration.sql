-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "registerShift" TEXT;

-- AlterTable
ALTER TABLE "PosOrder" ADD COLUMN     "registerShift" TEXT;

-- CreateTable
CREATE TABLE "RegisterShift" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "closeIdempotencyKey" TEXT,
    "shiftNumber" TEXT NOT NULL DEFAULT '',
    "registerName" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'open',
    "openingCashCents" INTEGER DEFAULT 0,
    "cashSalesCents" INTEGER DEFAULT 0,
    "cashRefundsCents" INTEGER DEFAULT 0,
    "cardSalesCents" INTEGER DEFAULT 0,
    "cardRefundsCents" INTEGER DEFAULT 0,
    "tipsCents" INTEGER DEFAULT 0,
    "payInsCents" INTEGER DEFAULT 0,
    "payOutsCents" INTEGER DEFAULT 0,
    "expectedCashCents" INTEGER DEFAULT 0,
    "countedCashCents" INTEGER,
    "cashVarianceCents" INTEGER,
    "openedBy" TEXT,
    "closedBy" TEXT,
    "openedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegisterShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "movementNumber" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "registerShift" TEXT,
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegisterShift_idempotencyKey_key" ON "RegisterShift"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RegisterShift_closeIdempotencyKey_key" ON "RegisterShift"("closeIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RegisterShift_shiftNumber_key" ON "RegisterShift"("shiftNumber");

-- CreateIndex
CREATE INDEX "RegisterShift_openedBy_idx" ON "RegisterShift"("openedBy");

-- CreateIndex
CREATE INDEX "RegisterShift_closedBy_idx" ON "RegisterShift"("closedBy");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_idempotencyKey_key" ON "CashMovement"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_movementNumber_key" ON "CashMovement"("movementNumber");

-- CreateIndex
CREATE INDEX "CashMovement_registerShift_idx" ON "CashMovement"("registerShift");

-- CreateIndex
CREATE INDEX "CashMovement_recordedBy_idx" ON "CashMovement"("recordedBy");

-- CreateIndex
CREATE INDEX "Payment_registerShift_idx" ON "Payment"("registerShift");

-- CreateIndex
CREATE INDEX "PosOrder_registerShift_idx" ON "PosOrder"("registerShift");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_registerShift_fkey" FOREIGN KEY ("registerShift") REFERENCES "RegisterShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_registerShift_fkey" FOREIGN KEY ("registerShift") REFERENCES "RegisterShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterShift" ADD CONSTRAINT "RegisterShift_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_registerShift_fkey" FOREIGN KEY ("registerShift") REFERENCES "RegisterShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bring Prisma 6 implicit many-to-many join tables into the primary-key form
-- emitted by the current schema generator so fresh deploys have no schema drift.
ALTER TABLE "_MenuItem_menuItemImages" ADD CONSTRAINT "_MenuItem_menuItemImages_AB_pkey" PRIMARY KEY ("A", "B");
DROP INDEX "_MenuItem_menuItemImages_AB_unique";
ALTER TABLE "_OrderItem_appliedModifiers" ADD CONSTRAINT "_OrderItem_appliedModifiers_AB_pkey" PRIMARY KEY ("A", "B");
DROP INDEX "_OrderItem_appliedModifiers_AB_unique";
