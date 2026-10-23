export const coffeeBoundaryTypeDefs = String.raw`
  type CoffeeNamedRef { id: ID name: String }
  type CoffeeStatusAction { status: String! label: String! tone: String! }

  type CoffeeMenuCategoryProjection {
    id: ID!
    name: String!
    description: String
    active: Boolean
    sortOrder: Int
  }
  type CoffeeMenuModifierProjection {
    id: ID!
    name: String!
    modifierGroup: String
    modifierGroupLabel: String
    priceAdjustment: Int!
    required: Boolean
    minSelections: Int
    maxSelections: Int
    defaultSelected: Boolean
    inStock: Boolean!
  }
  type CoffeeMenuItemProjection {
    id: ID!
    name: String!
    shortDescription: String
    price: Int!
    available: Boolean!
    availability: String
    featured: Boolean
    popular: Boolean
    imageUrl: String
    primaryImageUrl: String
    prepTimeMinutes: Int
    caffeineMg: Int
    barStation: String
    temperatureOptions: [String!]!
    dietaryFlags: [String!]!
    category: CoffeeNamedRef
    modifiers: [CoffeeMenuModifierProjection!]!
  }
  type CoffeeMenuProjection {
    categories: [CoffeeMenuCategoryProjection!]!
    items: [CoffeeMenuItemProjection!]!
    item: CoffeeMenuItemProjection
    nextCursor: String
    hasUncategorized: Boolean
  }
  type CoffeeMenuInventoryOption { id: ID! name: String! unit: String }
  type CoffeeMenuInventoryOptions { items: [CoffeeMenuInventoryOption!]! hasMore: Boolean! }
  type CoffeeManagedMenuModifier {
    id: ID!
    name: String!
    modifierGroup: String!
    modifierGroupLabel: String
    priceAdjustment: Int!
    required: Boolean!
    minSelections: Int!
    maxSelections: Int!
    defaultSelected: Boolean!
    inStock: Boolean!
    stockOut: Boolean
    updatedAt: String!
    inventoryAction: String
    inventoryQuantity: Float
    inventoryItem: CoffeeMenuInventoryOption
    replacesInventoryItem: CoffeeMenuInventoryOption
  }
  type CoffeeManagedMenuItem {
    id: ID!
    name: String!
    shortDescription: String
    price: Int!
    available: Boolean!
    featured: Boolean!
    popular: Boolean!
    prepTimeMinutes: Int
    barStation: String
    updatedAt: String!
    category: CoffeeNamedRef
    soldOut: Boolean
    modifiers: [CoffeeManagedMenuModifier!]!
    modifiersHasMore: Boolean!
  }
  type CoffeeManagedMenuStats { items: Int! hidden: Int! modifiersOut: Int! }
  type CoffeeManagedMenuProjection {
    canManageProducts: Boolean!
    categories: [CoffeeMenuCategoryProjection!]!
    categoriesHasMore: Boolean!
    matchingCount: Int!
    stats: CoffeeManagedMenuStats!
    hasMore: Boolean!
    nextCursor: String
    items: [CoffeeManagedMenuItem!]!
  }

  type CafeModifierSnapshotProjection {
    id: ID!
    name: String!
    group: String!
    groupLabel: String!
    priceAdjustment: Int!
  }
  type CafeOrderItemProjection {
    id: ID!
    quantity: Int!
    itemNameSnapshot: String
    imagePathSnapshot: String
    customizationsSummary: String
    modifierSnapshot: [CafeModifierSnapshotProjection!]!
    specialInstructions: String
    price: Int!
    barStatus: String
    station: String
  }
  type CafeOrderProjection {
    id: ID!
    orderNumber: String!
    status: String!
    handoffCode: String
    pickupName: String
    promisedAt: String
    subtotal: Int!
    tax: Int!
    tip: Int
    total: Int!
    currencyCode: String!
    orderItems: [CafeOrderItemProjection!]!
  }
  type CafeOrderReceipt {
    id: ID!
    orderNumber: String!
    status: String!
    handoffCode: String
    pickupName: String
    promisedAt: String
    subtotal: Int!
    tax: Int!
    tip: Int
    total: Int!
    currencyCode: String!
    secretKey: String!
    orderItems: [CafeOrderItemProjection!]!
  }
  type CafeLoyaltyProjection {
    id: ID!
    customerName: String
    customerEmail: String
    customerPhone: String
    status: String
    tier: String
    pointsBalance: Int!
    lifetimePoints: Int
    drinkCredits: Int!
    visits: Int
    lastVisitAt: String
    nextRewardProgress: Int
  }

  type CoffeeOrderQueueSummary {
    allCount: Int!
    activeCount: Int!
    openCount: Int!
    acceptedCount: Int!
    paidCount: Int!
    queuedCount: Int!
    preparingCount: Int!
    readyCount: Int!
    completedCount: Int!
    cancelledCount: Int!
    refundedCount: Int!
  }
  type CoffeeOrderQueueFilters {
    status: String!
    fulfillment: String!
  }
  type CoffeeRefundablePaymentProjection {
    id: ID!
    status: String!
    method: String!
    amount: Int!
    refundedAmount: Int
  }

  type CoffeeOrderQueueCapabilities {
    canManageOrders: Boolean!
    canManagePayments: Boolean!
    canManageLoyalty: Boolean!
  }
  type CoffeeOrderQueueTicket {
    id: ID!
    orderNumber: String!
    status: String!
    fulfillmentType: String
    orderSource: String
    customerName: String
    customerEmail: String
    pickupName: String
    promisedAt: DateTime
    total: Int!
    isRush: Boolean
    orderItems: [CafeOrderItemProjection!]!
    paymentState: String
    canRecordPayment: Boolean!
    canApplyLoyalty: Boolean!
    loyaltyApplied: Boolean
    refundablePayments: [CoffeeRefundablePaymentProjection!]!
    actions: [CoffeeStatusAction!]!
  }
  type CoffeeOrderQueueProjection {
    summary: CoffeeOrderQueueSummary!
    capabilities: CoffeeOrderQueueCapabilities!
    filters: CoffeeOrderQueueFilters!
    storeTimezone: String
    activeCount: Int!
    activeHasMore: Boolean!
    activeNextCursor: String
    historyCount: Int!
    historyHasMore: Boolean!
    historyNextCursor: String
    tickets: [CoffeeOrderQueueTicket!]!
  }
  type CoffeeKdsOrderRef {
    id: ID!
    orderNumber: String!
    status: String!
    pickupName: String
    promisedAt: DateTime
    isRush: Boolean
  }
  type CoffeeKdsItemProjection {
    id: ID!
    quantity: Int!
    itemNameSnapshot: String
    customizationsSummary: String
    specialInstructions: String
    barStatus: String!
    station: String
    queuedAt: DateTime
    startedAt: DateTime
    readyAt: DateTime
    order: CoffeeKdsOrderRef!
    nextAction: CoffeeStatusAction
  }
  type CoffeeKdsProjection {
    activeCount: Int!
    canManageOrders: Boolean!
    storeTimezone: String
    hasMore: Boolean!
    nextCursor: String
    items: [CoffeeKdsItemProjection!]!
  }

  type CoffeeRegisterShiftProjection {
    id: ID!
    shiftNumber: String!
    registerName: String
    status: String!
    openingCashCents: Int
    cashSalesCents: Int
    cardSalesCents: Int
    tipsCents: Int
    payInsCents: Int
    payOutsCents: Int
    expectedCashCents: Int
    openedAt: DateTime
  }
  type CoffeePosProjection {
    operatorId: ID!
    storeId: ID!
    items: [CoffeeMenuItemProjection!]!
    hasMore: Boolean!
    nextCursor: String
    categories: [CoffeeNamedRef!]!
    openShift: CoffeeRegisterShiftProjection
  }
  type CafeOrderQuoteLine {
    index: Int!
    menuItemId: ID!
    name: String!
    quantity: Int!
    unitPrice: Int!
    lineTotal: Int!
  }
  type CafeOrderQuote {
    subtotal: Int!
    tax: Int!
    tip: Int!
    total: Int!
    currencyCode: String!
    quoteFingerprint: String!
    estimatedPickupMinutes: Int!
    lines: [CafeOrderQuoteLine!]!
  }

  type CoffeeReportPeriod { period: String! startDate: String! endDate: String! timezone: String! timezoneConfigured: Boolean! }
  type CoffeeItemPerformance { key: String! menuItemId: ID name: String! quantity: Int! revenueCents: Float! }
  type CoffeeStationLoad { station: String! quantity: Int! }
  type CoffeeSalesReport {
    orderCount: Int!
    completedCount: Int!
    cancelledCount: Int!
    completionRatePercent: Int!
    grossSalesCents: Float!
    taxCents: Float!
    tipCents: Float!
    discountCents: Float!
    averageFulfillmentMinutes: Int
    fulfillmentSampleCount: Int!
    openTicketCount: Int!
    readyTicketCount: Int!
    topItems: [CoffeeItemPerformance!]!
    topItemsTruncated: Boolean!
    stationProduction: [CoffeeStationLoad!]!
  }
  type CoffeeCollectionsReport {
    currencyCode: String
    currencyMismatch: Boolean!
    paymentCount: Int!
    grossCollectedCents: Float
    refundedCents: Float
    netCollectedCents: Float
    needsReviewCount: Int!
  }
  type CoffeeLowStockItem {
    id: ID!
    name: String!
    category: String
    unit: String
    currentStock: Float!
    reorderPoint: Float!
    parLevel: Float!
    supplierName: String
  }
  type CoffeeLowStockReport { totalCount: Int! page: Int! pageSize: Int! items: [CoffeeLowStockItem!]! }
  type CoffeeLoyaltyReportAccount {
    id: ID!
    customerName: String
    customerEmail: String
    tier: String
    lifetimePoints: Int
    drinkCredits: Int
    lastVisitAt: DateTime
  }
  type CoffeeLoyaltyReport {
    accountCount: Int!
    totalVisits: Int!
    outstandingDrinkCredits: Int!
    topAccounts: [CoffeeLoyaltyReportAccount!]!
  }
  type CoffeeReportsProjection {
    storeTimezone: String
    period: CoffeeReportPeriod!
    sales: CoffeeSalesReport
    collections: CoffeeCollectionsReport
    lowStock: CoffeeLowStockReport
    loyalty: CoffeeLoyaltyReport
  }

  type CoffeeRecipeProjection { id: ID! name: String! status: String! yieldQuantity: Float yieldUnit: String active: Boolean! menuItem: CoffeeNamedRef }
  type CoffeeIngredientProjection { id: ID! name: String! quantity: Float unit: String optional: Boolean! recipe: CoffeeNamedRef inventoryItem: CoffeeNamedRef }
  type CoffeeInventoryLotProjection { id: ID! lotNumber: String! quantityReceived: Float quantityRemaining: Float unitCostCents: Int status: String! expiresAt: DateTime inventoryItem: CoffeeNamedRef supplier: CoffeeNamedRef }
  type CoffeeSupplierProjection { id: ID! name: String! status: String! contactName: String email: String phone: String leadTimeDays: Int }
  type CoffeePurchaseOrderProjection { id: ID! poNumber: String! status: String! subtotalCents: Int expectedAt: DateTime supplier: CoffeeNamedRef }
  type CoffeeInventoryUnitRef { id: ID name: String unit: String }
  type CoffeeReceiptPurchaseOrder { id: ID! poNumber: String! status: String! subtotalCents: Int expectedAt: DateTime orderedQuantity: Float unitCostCents: Int supplier: CoffeeNamedRef inventoryItem: CoffeeInventoryUnitRef }
  type CoffeeReceiptPurchaseOrderPage { items: [CoffeeReceiptPurchaseOrder!]! hasMore: Boolean! nextCursor: String loadError: Boolean! }
  type CoffeeOperationsOption { id: ID! name: String! detail: String unit: String currentStock: Float }
  type CoffeeOperationsOptionPage { items: [CoffeeOperationsOption!]! hasMore: Boolean! nextCursor: String loadError: Boolean! }
  type CoffeePrepBatchProjection { id: ID! batchNumber: String! status: String! quantityMade: Float recipe: CoffeeNamedRef preparedBy: CoffeeNamedRef expiresAt: DateTime }
  type CoffeeStaffRef { id: ID name: String email: String }
  type CoffeeStaffShiftProjection { id: ID! shiftNumber: String! role: String! status: String! startsAt: DateTime endsAt: DateTime clockInAt: DateTime clockOutAt: DateTime staff: CoffeeStaffRef actions: [CoffeeStatusAction!]! }
  type CoffeeStaffShiftPage { items: [CoffeeStaffShiftProjection!]! hasMore: Boolean! nextCursor: String loadError: Boolean! totalCount: Int }
  type CoffeePosOrderProjection { id: ID! receiptNumber: String! registerName: String status: String! subtotalCents: Int taxCents: Int tipCents: Int totalCents: Int cashier: CoffeeNamedRef }
  type CoffeeSubscriptionProjection { id: ID! subscriptionNumber: String! status: String! planName: String! billingInterval: String! priceCents: Int renewsAt: DateTime actions: [CoffeeStatusAction!]! }
  type CoffeeCateringProjection { id: ID! cateringNumber: String! customerName: String! customerEmail: String status: String! eventAt: DateTime guestCount: Int subtotalCents: Int actions: [CoffeeStatusAction!]! }
  type CoffeeWasteProjection { id: ID! logNumber: String! reason: String! quantity: Float unit: String costCents: Int inventoryItem: CoffeeNamedRef prepBatch: CoffeePrepBatchRef }
  type CoffeePrepBatchRef { batchNumber: String! }
  type CoffeeOperationsSections { inventory: Boolean! inventoryManage: Boolean! products: Boolean! staffing: Boolean! payments: Boolean! catering: Boolean! subscriptions: Boolean! }
  type CoffeeOperationsProjection {
    sections: CoffeeOperationsSections!
    storeTimezone: String
    draftScope: String!
    recipes: [CoffeeRecipeProjection!]!
    ingredients: [CoffeeIngredientProjection!]!
    inventoryLots: [CoffeeInventoryLotProjection!]!
    suppliers: [CoffeeSupplierProjection!]!
    purchaseOrders: [CoffeePurchaseOrderProjection!]!
    prepBatches: [CoffeePrepBatchProjection!]!
    wasteLogs: [CoffeeWasteProjection!]!
    posOrders: [CoffeePosOrderProjection!]!
    subscriptions: [CoffeeSubscriptionProjection!]!
    cateringOrders: [CoffeeCateringProjection!]!
    recentStaffShifts: [CoffeeStaffShiftProjection!]!
    receiptPurchaseOrders: CoffeeReceiptPurchaseOrderPage!
    purchaseSuppliers: CoffeeOperationsOptionPage!
    purchaseInventoryItems: CoffeeOperationsOptionPage!
    inventoryWasteItems: CoffeeOperationsOptionPage!
    wastePrepBatches: CoffeeOperationsOptionPage!
    prepRecipes: CoffeeOperationsOptionPage!
    staffMembers: CoffeeOperationsOptionPage!
    activeStaffShifts: CoffeeStaffShiftPage!
  }

  extend type Query {
    getCoffeeOrderQueue(search: String, status: String, fulfillment: String, includeCompleted: Boolean = true, activeCursor: String, historyCursor: String): CoffeeOrderQueueProjection!
    getCoffeeKdsBoard(cursor: String, limit: Int = 100): CoffeeKdsProjection!
    getCoffeeMenuManager(search: String, categoryId: ID, cursor: String, limit: Int = 50): CoffeeManagedMenuProjection!
    getCoffeeMenuInventoryOptions(search: String, limit: Int = 25): CoffeeMenuInventoryOptions!
    getCoffeePosRegister(search: String, categoryId: ID, cursor: String, limit: Int = 48): CoffeePosProjection!
    quoteCafeOrder(items: [CafePickupOrderItemInput!]!, tipCents: Int, requestedPickupMinutes: Int): CafeOrderQuote!
    getCoffeeReports(period: String, startDate: String, endDate: String, lowStockPage: Int): CoffeeReportsProjection!
    getCoffeeOperations(receiptCursor: String, purchaseSupplierSearch: String, purchaseSupplierCursor: String, purchaseInventorySearch: String, purchaseInventoryCursor: String, inventoryWasteSearch: String, inventoryWasteCursor: String, prepBatchSearch: String, prepBatchCursor: String, recipeSearch: String, recipeCursor: String, staffSearch: String, staffCursor: String, shiftCursor: String): CoffeeOperationsProjection!
  }
`;
