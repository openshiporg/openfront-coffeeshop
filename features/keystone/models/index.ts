import { CoffeeDomainEvent } from './CoffeeDomainEvent';
import { CoffeeOutboxDelivery } from './CoffeeOutboxDelivery';
import { WasteLog } from './WasteLog';
import { CateringOrder } from './CateringOrder';
import { Subscription } from './Subscription';
import { PosOrder } from './PosOrder';
import { RegisterShift } from './RegisterShift';
import { CashMovement } from './CashMovement';
import { StaffShift } from './StaffShift';
import { PrepBatch } from './PrepBatch';
import { PrepBatchConsumption } from './PrepBatchConsumption';
import { PurchaseOrder } from './PurchaseOrder';
import { Supplier } from './Supplier';
import { InventoryLot } from './InventoryLot';
import { Ingredient } from './Ingredient';
import { Recipe } from './Recipe';
import { User } from './User';
import { Role } from './Role';
import { MenuCategory } from './MenuCategory';
import { StoreSetting } from './StoreSettings';
import { MenuItem } from './MenuItem';
import { MenuItemImage } from './MenuItemImage';
import { MenuItemModifier } from './MenuItemModifier';
import { CafeOrder } from './CafeOrder';
import { OrderItem } from './OrderItem';
import { Payment } from './Payment';
import { PaymentEvent } from './PaymentEvent';
import { PaymentProvider } from './PaymentProvider';
import { InventoryItem } from './InventoryItem';
import { StockMovement } from './StockMovement';
import { LoyaltyAccount } from './LoyaltyAccount';
import { LoyaltyEvent } from './LoyaltyEvent';

import type { ListConfig, BaseListTypeInfo } from "@keystone-6/core/types";

type QueryAccess = (args: { session?: unknown; context: unknown; listKey: string; operation: "query" }) => boolean | Promise<boolean>;

/** Navigation follows read access: a list the session can't query is hidden from the sidebar
 *  (and, through sidebarAccess, the platform page that shares its path). Explicit settings win. */
function hiddenWithoutReadAccess<T extends Record<string, ListConfig<BaseListTypeInfo>>>(lists: T): T {
  for (const [listKey, config] of Object.entries(lists)) {
    const access = config.access as { operation?: { query?: QueryAccess } | QueryAccess } | undefined;
    const operation = access?.operation;
    const query = typeof operation === "function" ? operation : operation?.query;
    if (!query || config.ui?.isHidden !== undefined) continue;
    config.ui = { ...config.ui, isHidden: async ({ session, context }) => !(await query({ session, context, listKey, operation: "query" })) };
  }
  return lists;
}

export const models = hiddenWithoutReadAccess({
  User,
  Role,
  StoreSetting,
  MenuCategory,
  MenuItem,
  MenuItemImage,
  MenuItemModifier,
  CafeOrder,
  OrderItem,
  Payment,
  PaymentEvent,
  PaymentProvider,
  InventoryItem,
  StockMovement,
  LoyaltyAccount,
  LoyaltyEvent,
  CoffeeDomainEvent,
  CoffeeOutboxDelivery,
  WasteLog,
  CateringOrder,
  Subscription,
  PosOrder,
  RegisterShift,
  CashMovement,
  StaffShift,
  PrepBatch,
  PrepBatchConsumption,
  PurchaseOrder,
  Supplier,
  InventoryLot,
  Ingredient,
  Recipe,
});

export default models;
