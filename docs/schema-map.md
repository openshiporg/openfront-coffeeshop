# Coffee Shop schema map

A cafe that takes pickup orders online, sells at the counter, runs a bar (KDS), buys and preps stock, and keeps loyalty, catering and subscription accounts. One store per deployment (`StoreSetting.singletonKey = "primary"`), and every list belongs to that store.

Lists live in `features/keystone/models/`. Custom operations are in `features/keystone/mutations/` and are wired in `mutations/index.ts`; the boundary projections are in `coffeeBoundarySchema.ts`. Every money field is in cents, and every stock quantity is `Decimal(18,4)` in the inventory item's own unit.

## Lists

**Who creates it:**
- **M:** the merchant or staff, through the dashboard
- **C:** the customer, through the storefront
- **S:** the system, as a side effect of another command
- **O:** onboarding

| List | Purpose | Key fields | Relationships | Created by | States / transitions | Write path |
|---|---|---|---|---|---|---|
| StoreSetting | The cafe: identity, hours, pickup policy, tax | name, address, contactEmail, timezone, weeklyHours, pickupLeadTime/Window/Capacity, taxRateBasisPoints (decimal bp) | owns every list | O / M | – | generic update (Store Settings page); the effective-record validator runs on every write |
| MenuCategory | Menu section | name, active, sortOrder | MenuItem[] | O / M | active on/off | `createCoffeeMenuCategory`; generic edit |
| MenuItem | Something sold | price (cents), available, featured, popular, barStation, prepTimeMinutes, temperatureOptions, dietaryFlags, serviceWindows, caffeineMg, calories | category, modifiers, menuItemImages, inventoryItem (sold whole), orderItems | O / M | available on/off | `create/updateCoffeeMenuItem` (price, available, featured and popular are command-only) |
| MenuItemImage | Item photo | image (S3), imagePath, altText, order | MenuItem[] | O / M | – | generic CRUD |
| MenuItemModifier | Option on an item (size, milk, syrup, grind…) | modifierGroup, required, min/maxSelections, priceAdjustment, defaultSelected, inStock, inventoryAction (unreviewed/none/add/substitute), inventoryQuantity | menuItem, inventoryItem, replacesInventoryItem | O / M | inStock on/off | `create/updateCoffeeMenuModifier`, `updateCoffeeModifierStock` only |
| CafeOrder | An order, from online, POS or phone | orderNumber, status, fulfillmentType (pickup/counter/dine_in), orderSource, totals, promisedAt, handoffCode, secretKey | customer (User), orderItems, payments, stockMovements, loyaltyAccount | C (online request) / M (POS) | open → accepted → in_bar_queue → preparing → ready → completed. Also: paid at the counter; cancelled from open or accepted; refunded from paid. `transitionPolicy.ts` | commands only |
| OrderItem | Order line with price and modifier snapshot | quantity, price, modifierSnapshot, barStatus, station | order, menuItem, appliedModifiers | S | new → queued → preparing → ready → handed_off; voided (`kdsPolicy.ts`) | `updateCafeOrderItemStatus` (KDS) |
| Payment | Money in, and refunds | method (cash/card/manual), status, amount, refundedAmount | order, registerShift, refundRegisterShift, customer | S | captured → refunded | `recordCafePayment`, `refundCafePayment`, POS tender |
| PaymentEvent | Webhook replay evidence | replayKey, eventType, status | order, payment | S | processed / ignored | webhook (disabled: no provider secrets) |
| PaymentProvider | Non-secret provider enablement | code (pp_*), isInstalled | Payment[] | O / M | installed on/off | generic CRUD |
| PosOrder | Register receipt for a POS sale | receiptNumber, status, totals, metadata (tender evidence) | cafeOrder, cashier, registerShift | S | paid → refunded; open → voided (the void command has no caller, and POS receipts are created paid) | commands only |
| RegisterShift | Cash drawer session | shiftNumber, status, opening/expected/counted cash, sales/refunds/tips/pay-ins/outs, variance | posOrders, payments, cashMovements, openedBy/closedBy | M | open → closed | `openRegisterShift`, `closeRegisterShift` |
| CashMovement | Drawer pay-in, pay-out or drop | type, amountCents, reason | registerShift, recordedBy | M | – | `recordRegisterCashMovement` |
| InventoryItem | Stock-keeping item (beans, milk, croissants) | category, unit, currentStock (command-only), reorderPoint, parLevel, costPerUnit, supplierName, sku | menuItems, stockMovements, inventoryLots, purchaseOrders, wasteLogs | O / M | – (low when stock ≤ reorder point, out at 0) | generic create/edit of metadata; the unit is locked once the item has any history |
| InventoryLot | Received batch with remaining quantity and expiry | lotNumber, quantityReceived/Remaining, unitCostCents, expiresAt, status | inventoryItem, supplier, purchaseOrder | S (receiving) | active → consumed / expired / quarantined (only active and consumed are reachable) | commands only |
| StockMovement | Ledger of every stock change | type (received/sale/return/waste/adjustment/transfer), quantity, reason | inventoryItem, order, purchaseOrder, inventoryLot, prepBatch, wasteLog, createdBy | S | – | commands only |
| Supplier | Vendor | name, status, contact, email, phone, website, leadTimeDays | PurchaseOrder, InventoryLot | O / M | active / paused / archived (plain field) | generic CRUD; can't be deleted once it has purchasing evidence |
| PurchaseOrder | One-line order to a supplier | poNumber, orderedQuantity, unitCostCents, status, expectedAt, receivedAt | supplier, inventoryItem, lots, movements | M | submitted → received; draft and cancelled have no command | `createCoffeePurchaseOrder`, `receiveCoffeePurchaseOrder` |
| Recipe | How a menu item (or prep) is made, per yield | status (draft/active/archived), active, yieldQuantity, yieldUnit, prepInstructions, allergenNotes | menuItem; Ingredient (by recipe) | O / M | draft → active → archived (plain field) | generic CRUD |
| Ingredient | Recipe line drawn from inventory | quantity, unit (must equal the inventory unit), optional | recipe, inventoryItem | O / M | – | generic CRUD (validated) |
| PrepBatch | Batch made from a recipe (cold brew, syrups) | batchNumber, quantityMade/Remaining, expiresAt, status | recipe, preparedBy, consumptions, movements | M | completed → discarded (planned and in_progress unused) | `completeCoffeePrepBatch`, waste |
| PrepBatchConsumption | Order drew from a prep batch | quantity | prepBatch, order | S | – | commands only |
| WasteLog | Thrown-out stock | reason, quantity, costCents | inventoryItem or prepBatch, loggedBy | M | – | `recordCoffeeWaste` |
| StaffShift | Scheduled barista shift | role, status, startsAt/endsAt, clockIn/Out | staff (User) | O / M | scheduled → clocked_in → completed; scheduled → missed | `scheduleCoffeeStaffShift`, `updateCoffeeStaffShiftStatus` |
| LoyaltyAccount | Guest rewards account (by email) | status, tier, pointsBalance, lifetimePoints, drinkCredits, visits | customer (User), orders, events | S (apply loyalty) | active / paused / closed (no command) | `applyCafeLoyalty` only |
| LoyaltyEvent | Points ledger | type (earned/redeemed/manual_adjustment/refund_reversal/signup), pointsDelta, drinkCreditsDelta | account, order, createdBy | S | – | commands only |
| Subscription | Recurring plan for a loyalty account (no billing) | subscriptionNumber, planName, billingInterval, priceCents, startsAt, renewsAt | loyaltyAccount | M | trialing → active → paused ↔ active; any → cancelled | generic create; status only through `updateSubscriptionStatus` |
| CateringOrder | Event catering inquiry or quote | cateringNumber, customer, eventAt, guestCount, deliveryAddress, subtotalCents, status | – | M (C after this pass) | inquiry → quoted → confirmed → completed; any → cancelled. Event facts are editable until confirmed, the quote until quoted | generic create/edit; status only through `updateCateringOrderStatus` |
| User | Staff and customers | name, email, phone, role, onboardingStatus | role, cafeOrders, loyaltyAccount, payments | C (sign-up) / M | – | generic People, `registerCoffeeCustomer`, `updateCoffeeCustomerProfile` |
| Role | Permission set | can{Read,Manage}{Orders,Payments,Products,Inventory,Loyalty}, people, roles, settings, onboarding | User[] | O / M | – | generic Roles |
| CoffeeDomainEvent / CoffeeOutboxDelivery | Transactional outbox | eventType, payload, delivery status | – | S | pending → processing → delivered / retry / dead_letter | system only (hidden, denyAll) |

## Merchant workflows

1. **Build the menu:** MenuCategory → MenuItem → MenuItemModifier (+ inventory mapping) → MenuItemImage → Recipe → Ingredient → InventoryItem.
2. **Take an online pickup order:**
   1. The customer builds the cart and gets a quote (`quoteCafeOrder`).
   2. `createCafePickupOrder` creates the CafeOrder (open) and its OrderItem rows.
   3. Staff accept it (accepted), which consumes stock (StockMovement, InventoryLot, PrepBatchConsumption).
   4. KDS bumps move it to the bar queue, preparing and ready.
   5. Payment at pickup: `recordCafePayment` writes a Payment against the RegisterShift.
   6. Completed. Loyalty (`applyCafeLoyalty`) writes LoyaltyAccount and LoyaltyEvent.
3. **Counter sale:** open a RegisterShift → POS ticket → `createCafePickupOrder` (paid). That writes CafeOrder, PosOrder and Payment, and consumes stock. KDS takes it to handed off.
4. **Refund:** `refundCafePayment` → Payment refunded, CafeOrder and PosOrder refunded, RegisterShift refund totals, and a LoyaltyEvent reversal.
5. **Run the drawer:** RegisterShift open → CashMovement → close with the counted cash and variance.
6. **Buy stock:** Supplier → PurchaseOrder (submitted) → receive, which creates an InventoryLot (active) and a StockMovement (received) and raises InventoryItem.currentStock.
7. **Keep stock true:** WasteLog and stock counts write StockMovement adjustments; low stock means at or below the reorder point.
8. **Prep:** Recipe (active) + Ingredient → PrepBatch (completed), which consumes the ingredients. Orders then draw from the batch, and the leftover is wasted.
9. **Staff the bar:** User and Role → StaffShift scheduled → clocked in → completed (or missed).
10. **Rewards:** LoyaltyAccount and LoyaltyEvent. The merchant needs to see accounts, their history and orders, and to adjust or pause them.
11. **Catering:** an inquiry (customer or staff) becomes quoted, then confirmed, then completed or cancelled.
12. **Subscriptions:** created against a LoyaltyAccount, then moved between trialing, active, paused and cancelled.
13. **Report:** CafeOrder, OrderItem, Payment, InventoryItem and LoyaltyAccount feed Analytics.

## Coverage before this pass

**Generic:** "generic" means the auto-generated Models pages (`/dashboard/<list>`). They can edit a record's raw fields, but they can't run commands or show the related records together.

| Workflow / list | Platform page (route · slice) | Coverage |
|---|---|---|
| Menu: categories, items, options, stock flags | `/platform/menu` · `menu` | Covered. Category edit and sort, and images, only through generic |
| Menu images | none | THIN (generic only) |
| Online and counter orders, acceptance, payment, refund, loyalty apply | `/platform/orders` · `orders` | Covered (no per-order detail page) |
| Bar queue | `/platform/kds` · `kds` | Covered |
| Counter sale, drawer open, movements and close | `/platform/pos` · `pos` | Covered for the current shift |
| RegisterShift history, CashMovement, PosOrder, Payment ledger | none (Coffee Operations shows 8 recent POS orders, read-only) | **MISSING** |
| Inventory items (list, low/out, create/edit, lots and movements per item) | none (only pickers inside Coffee Operations) | **MISSING** |
| Suppliers | Coffee Operations: 8 recent, read-only | **THIN**: no create, edit or status, no detail with POs and lots |
| Purchase orders, receiving | Coffee Operations · Order stock, Receive | Covered (no cancel command) |
| Recipes and ingredients | Coffee Operations: 8 recent, read-only; prep picker | **THIN**: no recipe builder, activation or ingredient editing |
| Prep batches, waste, stock count | Coffee Operations · Prep, Waste, Count stock | Covered |
| Staff shifts | Coffee Operations · Shifts | Covered (no "missed") |
| Staff and roles | generic People and Roles | Covered by generic (shell-owned lists) |
| Loyalty accounts and events | Analytics: top accounts only | **MISSING** |
| Catering | Coffee Operations: 8 recent, view only; the status command has no caller | **MISSING**: catering status can't be changed anywhere |
| Subscriptions | Coffee Operations: 8 recent, view only; the status command has no caller | **MISSING**: subscription status can't be changed anywhere |
| Analytics | `/platform/reports` · `reports` | Covered |
| Store settings, hours, tax, branding | `/platform/store-settings` · `store-settings` | Covered |
| Payment providers | generic | Covered by generic. Online payment is blocked on secrets, an owner decision |
| Join and system lists: OrderItem, StockMovement, PrepBatchConsumption, PaymentEvent, LoyaltyEvent, CoffeeDomainEvent / CoffeeOutboxDelivery | parents: Orders and KDS (OrderItem), Inventory detail (StockMovement), Coffee Operations (PrepBatchConsumption), Register (PaymentEvent), Loyalty detail (LoyaltyEvent) | Outbox is system-only, with no page by design |

### Storefront (customer workflows)

| Workflow | Routes | Coverage |
|---|---|---|
| Browse, search, item detail, cart | `/`, `/menu/[id]`, cart bar | Covered |
| Checkout (order ahead, pickup time) | `/checkout` | Covered (pay at pickup) |
| Confirmation and status | `/order-confirmed` | Covered |
| Account, order history, profile, password reset | `/account`, `/account/reset` | Covered |
| Rewards: balance | `/account` Rewards panel | Covered |
| Rewards: earn points on an order | none (customer `applyCafeLoyalty` path unused) | **MISSING** |
| Catering inquiry | none | **MISSING** |
| Subscriptions | none | Not offered. There is no billing provider (Stripe secrets are an owner decision) |
| Online payment | none | Blocked on Stripe secrets |


## Coverage after this pass

| Workflow / list | Platform page (route · slice) | Coverage |
|---|---|---|
| Menu, KDS, POS, Orders, Analytics, Store Settings, Coffee Operations | unchanged routes | Covered |
| RegisterShift history, CashMovement, PosOrder, Payment ledger | `/platform/register`, `/platform/register/[id]`, `?view=payments` · `register` | Covered (read-only: there are no shift edit commands; refunds stay on Orders) |
| Inventory items, lots, movements, waste per item | `/platform/inventory`, `/platform/inventory/[id]` · `inventory` | Covered: All / Low / Out tabs, create and edit, movement ledger, lots, POs with cancel |
| Suppliers and their purchase orders and lots | `/platform/suppliers`, `/platform/suppliers/[id]` · `suppliers` | Covered: status tabs, create and edit, Pause / Activate / Archive, delete when unused, PO cancel |
| Purchase order cancel | `cancelCoffeePurchaseOrder` (new), on inventory and supplier detail | Covered |
| Recipes and ingredients | `/platform/recipes`, `/platform/recipes/[id]` · `recipes` | Covered: Draft / Active / Archived tabs, builder, cost per yield unit, servings from stock, one active recipe per item |
| Loyalty accounts and events | `/platform/loyalty`, `/platform/loyalty/[id]` · `loyalty` | Covered: adjust points and credits, pause / reactivate / close, tier, full ledger (`adjustCoffeeLoyaltyAccount`, new) |
| Catering | `/platform/catering`, `/platform/catering/[id]` · `catering` | Covered: staff inquiries, quote, Send quote / Confirm / Complete / Cancel |
| Subscriptions | `/platform/subscriptions`, `/platform/subscriptions/[id]` · `subscriptions` | Covered: create against an account, Activate / Pause / Resume / Cancel |
| Menu images | generic MenuItemImage, via the Menu "Full record" link | THIN (kept on the generic page) |
| Staff and roles | generic People and Roles | Covered by generic |
| Payment providers, online payment | generic | Blocked on Stripe secrets (owner decision) |

Join and system lists are covered by their parents:
- OrderItem, by Orders and KDS.
- StockMovement, by Inventory detail.
- PrepBatchConsumption, by Coffee Operations.
- LoyaltyEvent, by Rewards detail.
- PaymentEvent has no page while the webhook is disabled.
- The outbox lists are system-only.

### Storefront after this pass

| Workflow | Routes | Coverage |
|---|---|---|
| Catering inquiry | `/catering` (`requestCafeCatering`, new) | Covered |
| Customer's catering requests | `/account` Catering panel (`getCoffeeCustomerCatering`, new) | Covered |
| Earn rewards on an order | `/order-confirmed` "Add to rewards" (`applyCafeLoyalty`; the receipt now returns `rewardsEligible` and `rewardsLinked`) | Covered |
| Subscriptions, online payment | none | Not offered: no billing provider without the Stripe secrets |
