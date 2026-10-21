"use server";

import { revalidatePath } from "next/cache";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { OPERATIONS_PATH } from "../lib/operationsTypes";

function refreshOperations<T>(result: T) {
  revalidatePath(OPERATIONS_PATH);
  revalidatePath("/dashboard/platform/reports");
  return result;
}

export async function createPurchaseOrderAction(input: { supplierId: string; inventoryItemId: string; orderedQuantity: number; unitCostCents: number; expectedAt?: string; notes?: string; idempotencyKey: string }) {
  return refreshOperations(await keystoneClient(`
    mutation CreatePurchaseOrder($supplierId: ID!, $inventoryItemId: ID!, $orderedQuantity: Float!, $unitCostCents: Int!, $expectedAt: String, $notes: String, $idempotencyKey: String!) {
      createCoffeePurchaseOrder(supplierId: $supplierId, inventoryItemId: $inventoryItemId, orderedQuantity: $orderedQuantity, unitCostCents: $unitCostCents, expectedAt: $expectedAt, notes: $notes, idempotencyKey: $idempotencyKey) { id poNumber status subtotalCents }
    }
  `, input, { cache: "no-store" }));
}

export async function receivePurchaseOrderAction(purchaseOrderId: string, expiresAt?: string) {
  return refreshOperations(await keystoneClient(`
    mutation ReceivePurchaseOrder($purchaseOrderId: ID!, $expiresAt: String) {
      receiveCoffeePurchaseOrder(purchaseOrderId: $purchaseOrderId, expiresAt: $expiresAt) { id lotNumber status quantityReceived quantityRemaining }
    }
  `, { purchaseOrderId, expiresAt }, { cache: "no-store" }));
}

export async function completePrepBatchAction(input: { recipeId: string; quantityMade: number; expiresAt?: string; notes?: string; idempotencyKey: string }) {
  return refreshOperations(await keystoneClient(`
    mutation CompletePrepBatch($recipeId: ID!, $quantityMade: Float!, $expiresAt: String, $notes: String, $idempotencyKey: String!) {
      completeCoffeePrepBatch(recipeId: $recipeId, quantityMade: $quantityMade, expiresAt: $expiresAt, notes: $notes, idempotencyKey: $idempotencyKey) { id batchNumber status quantityMade expiresAt }
    }
  `, input, { cache: "no-store" }));
}

export async function recordWasteAction(input: { inventoryItemId?: string; prepBatchId?: string; quantity: number; reason: string; notes?: string; idempotencyKey: string }) {
  return refreshOperations(await keystoneClient(`
    mutation RecordWaste($inventoryItemId: ID, $prepBatchId: ID, $quantity: Float!, $reason: String!, $notes: String, $idempotencyKey: String!) {
      recordCoffeeWaste(inventoryItemId: $inventoryItemId, prepBatchId: $prepBatchId, quantity: $quantity, reason: $reason, notes: $notes, idempotencyKey: $idempotencyKey) { id logNumber reason quantity unit costCents }
    }
  `, input, { cache: "no-store" }));
}

export async function scheduleStaffShiftAction(input: { staffId: string; role: string; startsAt: string; endsAt: string; notes?: string; idempotencyKey: string }) {
  return refreshOperations(await keystoneClient(`
    mutation ScheduleStaffShift($staffId: ID!, $role: String!, $startsAt: String!, $endsAt: String!, $notes: String, $idempotencyKey: String!) {
      scheduleCoffeeStaffShift(staffId: $staffId, role: $role, startsAt: $startsAt, endsAt: $endsAt, notes: $notes, idempotencyKey: $idempotencyKey) { id shiftNumber role status startsAt endsAt }
    }
  `, input, { cache: "no-store" }));
}

export async function updateStaffShiftAction(input: { staffShiftId: string; status: "clocked_in" | "completed"; expectedStatus: string; idempotencyKey: string }) {
  return refreshOperations(await keystoneClient(`
    mutation UpdateStaffShift($staffShiftId: ID!, $status: String!, $expectedStatus: String, $idempotencyKey: String!) {
      updateCoffeeStaffShiftStatus(staffShiftId: $staffShiftId, status: $status, expectedStatus: $expectedStatus, idempotencyKey: $idempotencyKey) { id shiftNumber status clockInAt clockOutAt }
    }
  `, input, { cache: "no-store" }));
}

export async function updateSubscriptionAction(subscriptionId: string, status: "active" | "paused" | "cancelled") {
  return refreshOperations(await keystoneClient(`
    mutation UpdateSubscription($subscriptionId: ID!, $status: String!) {
      updateSubscriptionStatus(subscriptionId: $subscriptionId, status: $status) { id subscriptionNumber status cancelledAt }
    }
  `, { subscriptionId, status }, { cache: "no-store" }));
}

export async function updateCateringAction(cateringOrderId: string, status: "quoted" | "confirmed" | "completed" | "cancelled") {
  return refreshOperations(await keystoneClient(`
    mutation UpdateCatering($cateringOrderId: ID!, $status: String!) {
      updateCateringOrderStatus(cateringOrderId: $cateringOrderId, status: $status) { id cateringNumber status }
    }
  `, { cateringOrderId, status }, { cache: "no-store" }));
}
