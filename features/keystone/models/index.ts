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

export const models = {
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
};

export default models;
