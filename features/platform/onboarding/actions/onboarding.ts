"use server";

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

type CurrentUser = { authenticatedItem?: { id: string; onboardingStatus?: string | null } | null };

const CURRENT_USER = `
  query CurrentOnboardingUser {
    authenticatedItem { ... on User { id onboardingStatus } }
  }
`;

async function currentUser() {
  const current = await keystoneClient<CurrentUser>(CURRENT_USER, {}, { cache: "no-store" });
  if (!current.success) return { success: false as const, error: current.error };
  const user = current.data.authenticatedItem;
  if (!user?.id) return { success: false as const, error: "No authenticated user found" };
  return { success: true as const, user };
}

async function setOnboardingStatus(id: string, status: "in_progress" | "dismissed") {
  return keystoneClient(`
    mutation UpdateOnboardingStatus($id: ID!, $status: String!) {
      updateUser(where: { id: $id }, data: { onboardingStatus: $status }) { id onboardingStatus }
    }
  `, { id, status });
}

/** Dismissal is user-local. Setup completion is only written by runCoffeeOnboarding. */
export async function dismissOnboarding() {
  try {
    const current = await currentUser();
    if (!current.success) return { success: false, error: current.error };
    const response = await setOnboardingStatus(current.user.id, "dismissed");
    if (!response.success) return { success: false, error: response.error };

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Unable to dismiss onboarding" };
  }
}

/** Marks setup as in progress (unless already completed) and returns the prior status. */
export async function startOnboarding(): Promise<{ success: boolean; previousStatus: string | null }> {
  try {
    const current = await currentUser();
    if (!current.success) return { success: false, previousStatus: null };
    const previousStatus = current.user.onboardingStatus ?? null;
    if (previousStatus !== "completed") await setOnboardingStatus(current.user.id, "in_progress");
    return { success: true, previousStatus };
  } catch {
    return { success: false, previousStatus: null };
  }
}

/** Reads the durable setup status recorded by the onboarding transaction. */
export async function getOnboardingStatus(): Promise<string | null> {
  try {
    const current = await currentUser();
    return current.success ? current.user.onboardingStatus ?? null : null;
  } catch {
    return null;
  }
}

/** Refreshes the dashboard shell after a verified setup completion. */
export async function refreshAfterOnboarding() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/", "layout");
}
