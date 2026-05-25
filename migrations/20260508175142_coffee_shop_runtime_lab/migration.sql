/*
  Warnings:

  - You are about to drop the column `canCreateTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canManageAllTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the `Todo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TodoImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_Todo_todoImages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_A_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_B_fkey";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "canCreateTodos",
DROP COLUMN "canManageAllTodos",
ADD COLUMN     "canManageInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageLoyalty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageOnboarding" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canManageOrders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageProducts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSettings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadLoyalty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadOrders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadPayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadProducts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "onboardingStatus" TEXT DEFAULT 'not_started',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "Todo";

-- DropTable
DROP TABLE "TodoImage";

-- DropTable
DROP TABLE "_Todo_todoImages";

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" JSONB NOT NULL DEFAULT '[{"type":"paragraph","children":[{"text":""}]}]',
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "prepTimeMinutes" INTEGER DEFAULT 5,
    "caffeineMg" INTEGER,
    "calories" INTEGER,
    "barStation" TEXT DEFAULT 'espresso_bar',
    "temperatureOptions" JSONB NOT NULL DEFAULT '["hot"]',
    "dietaryFlags" JSONB NOT NULL DEFAULT '[]',
    "serviceWindows" JSONB NOT NULL DEFAULT '["all_day"]',
    "category" TEXT,
    "inventoryItem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemModifier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "modifierGroup" TEXT DEFAULT 'milk',
    "modifierGroupLabel" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "minSelections" INTEGER DEFAULT 0,
    "maxSelections" INTEGER DEFAULT 1,
    "priceAdjustment" INTEGER DEFAULT 0,
    "defaultSelected" BOOLEAN NOT NULL DEFAULT false,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "menuItem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL DEFAULT '',
    "fulfillmentType" TEXT DEFAULT 'pickup',
    "orderSource" TEXT DEFAULT 'online',
    "status" TEXT DEFAULT 'open',
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerEmail" TEXT NOT NULL DEFAULT '',
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "pickupName" TEXT NOT NULL DEFAULT '',
    "specialInstructions" TEXT NOT NULL DEFAULT '',
    "subtotal" INTEGER DEFAULT 0,
    "tax" INTEGER DEFAULT 0,
    "tip" INTEGER DEFAULT 0,
    "discount" INTEGER DEFAULT 0,
    "total" INTEGER DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "paidAt" TIMESTAMP(3),
    "promisedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "isRush" BOOLEAN NOT NULL DEFAULT false,
    "handoffCode" TEXT NOT NULL DEFAULT '',
    "secretKey" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "loyaltyAccount" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CafeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" INTEGER NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL DEFAULT '',
    "customizationsSummary" TEXT NOT NULL DEFAULT '',
    "specialInstructions" TEXT NOT NULL DEFAULT '',
    "barStatus" TEXT DEFAULT 'new',
    "station" TEXT DEFAULT 'espresso_bar',
    "queuedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "handedOffAt" TIMESTAMP(3),
    "order" TEXT,
    "menuItem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "status" TEXT DEFAULT 'pending',
    "method" TEXT DEFAULT 'card',
    "amount" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "providerPaymentId" TEXT NOT NULL DEFAULT '',
    "failureMessage" TEXT NOT NULL DEFAULT '',
    "processedAt" TIMESTAMP(3),
    "order" TEXT,
    "customer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "category" TEXT DEFAULT 'coffee',
    "unit" TEXT DEFAULT 'each',
    "currentStock" DECIMAL(18,4) DEFAULT 0,
    "reorderPoint" DECIMAL(18,4) DEFAULT 0,
    "parLevel" DECIMAL(18,4) DEFAULT 0,
    "costPerUnit" INTEGER DEFAULT 0,
    "supplierName" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "type" TEXT DEFAULT 'adjustment',
    "quantity" DECIMAL(18,4) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "inventoryItem" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerEmail" TEXT NOT NULL DEFAULT '',
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT DEFAULT 'active',
    "tier" TEXT DEFAULT 'regular',
    "pointsBalance" INTEGER DEFAULT 0,
    "lifetimePoints" INTEGER DEFAULT 0,
    "drinkCredits" INTEGER DEFAULT 0,
    "visits" INTEGER DEFAULT 0,
    "lastVisitAt" TIMESTAMP(3),
    "firstVisitAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT DEFAULT 'earned',
    "pointsDelta" INTEGER DEFAULT 0,
    "drinkCreditsDelta" INTEGER DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "account" TEXT,
    "order" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_OrderItem_appliedModifiers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "MenuItem_category_idx" ON "MenuItem"("category");

-- CreateIndex
CREATE INDEX "MenuItem_inventoryItem_idx" ON "MenuItem"("inventoryItem");

-- CreateIndex
CREATE INDEX "MenuItemModifier_menuItem_idx" ON "MenuItemModifier"("menuItem");

-- CreateIndex
CREATE UNIQUE INDEX "CafeOrder_orderNumber_key" ON "CafeOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "CafeOrder_customer_idx" ON "CafeOrder"("customer");

-- CreateIndex
CREATE INDEX "CafeOrder_loyaltyAccount_idx" ON "CafeOrder"("loyaltyAccount");

-- CreateIndex
CREATE INDEX "OrderItem_order_idx" ON "OrderItem"("order");

-- CreateIndex
CREATE INDEX "OrderItem_menuItem_idx" ON "OrderItem"("menuItem");

-- CreateIndex
CREATE INDEX "Payment_order_idx" ON "Payment"("order");

-- CreateIndex
CREATE INDEX "Payment_customer_idx" ON "Payment"("customer");

-- CreateIndex
CREATE INDEX "StockMovement_inventoryItem_idx" ON "StockMovement"("inventoryItem");

-- CreateIndex
CREATE INDEX "StockMovement_createdBy_idx" ON "StockMovement"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_customerEmail_key" ON "LoyaltyAccount"("customerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_customer_key" ON "LoyaltyAccount"("customer");

-- CreateIndex
CREATE INDEX "LoyaltyEvent_account_idx" ON "LoyaltyEvent"("account");

-- CreateIndex
CREATE INDEX "LoyaltyEvent_order_idx" ON "LoyaltyEvent"("order");

-- CreateIndex
CREATE INDEX "LoyaltyEvent_createdBy_idx" ON "LoyaltyEvent"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "_OrderItem_appliedModifiers_AB_unique" ON "_OrderItem_appliedModifiers"("A", "B");

-- CreateIndex
CREATE INDEX "_OrderItem_appliedModifiers_B_index" ON "_OrderItem_appliedModifiers"("B");

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_category_fkey" FOREIGN KEY ("category") REFERENCES "MenuCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_inventoryItem_fkey" FOREIGN KEY ("inventoryItem") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemModifier" ADD CONSTRAINT "MenuItemModifier_menuItem_fkey" FOREIGN KEY ("menuItem") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeOrder" ADD CONSTRAINT "CafeOrder_customer_fkey" FOREIGN KEY ("customer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeOrder" ADD CONSTRAINT "CafeOrder_loyaltyAccount_fkey" FOREIGN KEY ("loyaltyAccount") REFERENCES "LoyaltyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_order_fkey" FOREIGN KEY ("order") REFERENCES "CafeOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItem_fkey" FOREIGN KEY ("menuItem") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_order_fkey" FOREIGN KEY ("order") REFERENCES "CafeOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customer_fkey" FOREIGN KEY ("customer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryItem_fkey" FOREIGN KEY ("inventoryItem") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_customer_fkey" FOREIGN KEY ("customer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyEvent" ADD CONSTRAINT "LoyaltyEvent_account_fkey" FOREIGN KEY ("account") REFERENCES "LoyaltyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyEvent" ADD CONSTRAINT "LoyaltyEvent_order_fkey" FOREIGN KEY ("order") REFERENCES "CafeOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyEvent" ADD CONSTRAINT "LoyaltyEvent_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrderItem_appliedModifiers" ADD CONSTRAINT "_OrderItem_appliedModifiers_A_fkey" FOREIGN KEY ("A") REFERENCES "MenuItemModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrderItem_appliedModifiers" ADD CONSTRAINT "_OrderItem_appliedModifiers_B_fkey" FOREIGN KEY ("B") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
