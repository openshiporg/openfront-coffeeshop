-- AlterTable
ALTER TABLE "_OrderItem_appliedModifiers" ADD CONSTRAINT "_OrderItem_appliedModifiers_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_OrderItem_appliedModifiers_AB_unique";

-- CreateTable
CREATE TABLE "WasteLog" (
    "id" TEXT NOT NULL,
    "logNumber" TEXT NOT NULL DEFAULT '',
    "inventoryItem" TEXT,
    "prepBatch" TEXT,
    "reason" TEXT DEFAULT 'expired',
    "quantity" DECIMAL(18,4) DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "costCents" INTEGER DEFAULT 0,
    "loggedBy" TEXT,
    "loggedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasteLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CateringOrder" (
    "id" TEXT NOT NULL,
    "cateringNumber" TEXT NOT NULL DEFAULT '',
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerEmail" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'inquiry',
    "eventAt" TIMESTAMP(3),
    "guestCount" INTEGER DEFAULT 0,
    "deliveryAddress" TEXT NOT NULL DEFAULT '',
    "subtotalCents" INTEGER DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CateringOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "subscriptionNumber" TEXT NOT NULL DEFAULT '',
    "loyaltyAccount" TEXT,
    "status" TEXT DEFAULT 'trialing',
    "planName" TEXT NOT NULL DEFAULT '',
    "billingInterval" TEXT DEFAULT 'monthly',
    "priceCents" INTEGER DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "renewsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosOrder" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL DEFAULT '',
    "cafeOrder" TEXT,
    "cashier" TEXT,
    "registerName" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'open',
    "subtotalCents" INTEGER DEFAULT 0,
    "taxCents" INTEGER DEFAULT 0,
    "tipCents" INTEGER DEFAULT 0,
    "totalCents" INTEGER DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffShift" (
    "id" TEXT NOT NULL,
    "shiftNumber" TEXT NOT NULL DEFAULT '',
    "staff" TEXT,
    "role" TEXT DEFAULT 'barista',
    "status" TEXT DEFAULT 'scheduled',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "clockInAt" TIMESTAMP(3),
    "clockOutAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL DEFAULT '',
    "recipe" TEXT,
    "status" TEXT DEFAULT 'planned',
    "preparedBy" TEXT,
    "quantityMade" DECIMAL(18,4) DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL DEFAULT '',
    "supplier" TEXT,
    "status" TEXT DEFAULT 'draft',
    "orderedAt" TIMESTAMP(3),
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "subtotalCents" INTEGER DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "status" TEXT DEFAULT 'active',
    "contactName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "leadTimeDays" INTEGER DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL DEFAULT '',
    "inventoryItem" TEXT,
    "supplier" TEXT,
    "quantityReceived" DECIMAL(18,4) DEFAULT 0,
    "quantityRemaining" DECIMAL(18,4) DEFAULT 0,
    "unitCostCents" INTEGER DEFAULT 0,
    "receivedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "inventoryItem" TEXT,
    "recipe" TEXT,
    "quantity" DECIMAL(18,4) DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "menuItem" TEXT,
    "status" TEXT DEFAULT 'draft',
    "yieldQuantity" DECIMAL(18,4) DEFAULT 1,
    "yieldUnit" TEXT NOT NULL DEFAULT 'serving',
    "prepInstructions" TEXT NOT NULL DEFAULT '',
    "allergenNotes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WasteLog_logNumber_key" ON "WasteLog"("logNumber");

-- CreateIndex
CREATE INDEX "WasteLog_inventoryItem_idx" ON "WasteLog"("inventoryItem");

-- CreateIndex
CREATE INDEX "WasteLog_prepBatch_idx" ON "WasteLog"("prepBatch");

-- CreateIndex
CREATE INDEX "WasteLog_loggedBy_idx" ON "WasteLog"("loggedBy");

-- CreateIndex
CREATE UNIQUE INDEX "CateringOrder_cateringNumber_key" ON "CateringOrder"("cateringNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_subscriptionNumber_key" ON "Subscription"("subscriptionNumber");

-- CreateIndex
CREATE INDEX "Subscription_loyaltyAccount_idx" ON "Subscription"("loyaltyAccount");

-- CreateIndex
CREATE UNIQUE INDEX "PosOrder_receiptNumber_key" ON "PosOrder"("receiptNumber");

-- CreateIndex
CREATE INDEX "PosOrder_cafeOrder_idx" ON "PosOrder"("cafeOrder");

-- CreateIndex
CREATE INDEX "PosOrder_cashier_idx" ON "PosOrder"("cashier");

-- CreateIndex
CREATE UNIQUE INDEX "StaffShift_shiftNumber_key" ON "StaffShift"("shiftNumber");

-- CreateIndex
CREATE INDEX "StaffShift_staff_idx" ON "StaffShift"("staff");

-- CreateIndex
CREATE UNIQUE INDEX "PrepBatch_batchNumber_key" ON "PrepBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "PrepBatch_recipe_idx" ON "PrepBatch"("recipe");

-- CreateIndex
CREATE INDEX "PrepBatch_preparedBy_idx" ON "PrepBatch"("preparedBy");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplier_idx" ON "PurchaseOrder"("supplier");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_lotNumber_key" ON "InventoryLot"("lotNumber");

-- CreateIndex
CREATE INDEX "InventoryLot_inventoryItem_idx" ON "InventoryLot"("inventoryItem");

-- CreateIndex
CREATE INDEX "InventoryLot_supplier_idx" ON "InventoryLot"("supplier");

-- CreateIndex
CREATE INDEX "Ingredient_inventoryItem_idx" ON "Ingredient"("inventoryItem");

-- CreateIndex
CREATE INDEX "Ingredient_recipe_idx" ON "Ingredient"("recipe");

-- CreateIndex
CREATE INDEX "Recipe_menuItem_idx" ON "Recipe"("menuItem");

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_inventoryItem_fkey" FOREIGN KEY ("inventoryItem") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_prepBatch_fkey" FOREIGN KEY ("prepBatch") REFERENCES "PrepBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_loggedBy_fkey" FOREIGN KEY ("loggedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_loyaltyAccount_fkey" FOREIGN KEY ("loyaltyAccount") REFERENCES "LoyaltyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_cafeOrder_fkey" FOREIGN KEY ("cafeOrder") REFERENCES "CafeOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_cashier_fkey" FOREIGN KEY ("cashier") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_staff_fkey" FOREIGN KEY ("staff") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_recipe_fkey" FOREIGN KEY ("recipe") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_preparedBy_fkey" FOREIGN KEY ("preparedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_inventoryItem_fkey" FOREIGN KEY ("inventoryItem") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_inventoryItem_fkey" FOREIGN KEY ("inventoryItem") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_recipe_fkey" FOREIGN KEY ("recipe") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_menuItem_fkey" FOREIGN KEY ("menuItem") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

