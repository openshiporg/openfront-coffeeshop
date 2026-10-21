"use server";

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import type { KdsItemStatus } from "../types";
import type { CoffeeKdsCommandReceipt } from "@/features/keystone/mutations/coffeeKdsReceipt";

export async function updateKdsItemAction(input: { orderItemId: string; status: KdsItemStatus; expectedStatus: KdsItemStatus; idempotencyKey: string }) {
  const response = await keystoneClient<{ updateCafeOrderItemStatus: CoffeeKdsCommandReceipt }>(`
    mutation UpdateCafeOrderItemStatus($orderItemId: ID!, $status: String!, $expectedStatus: String!, $idempotencyKey: String!) {
      updateCafeOrderItemStatus(orderItemId: $orderItemId, status: $status, expectedStatus: $expectedStatus, idempotencyKey: $idempotencyKey) {
        id quantity itemNameSnapshot customizationsSummary barStatus station queuedAt startedAt readyAt handedOffAt
        idempotencyKey expectedStatus requestedStatus actorId storeId
        order { id orderNumber status pickupName promisedAt }
      }
    }
  `, input, { cache: "no-store" });
  revalidatePath("/dashboard/platform/kds");
  revalidatePath("/dashboard/platform/orders");
  revalidatePath("/order-confirmed");
  return response;
}
