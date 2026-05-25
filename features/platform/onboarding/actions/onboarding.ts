'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

export async function updateOnboardingStatus(status: OnboardingStatus) {
  try {
    const query = `
      query CurrentUser {
        authenticatedItem {
          ... on User { id }
        }
      }
    `;

    const current = await keystoneClient<{ authenticatedItem?: { id: string } | null }>(query);
    if (!current.success || !current.data.authenticatedItem?.id) {
      return { success: false, error: current.success ? 'No authenticated user found' : current.error };
    }

    const mutation = `
      mutation UpdateUser($id: ID!, $data: UserUpdateInput!) {
        updateUser(where: { id: $id }, data: $data) { id onboardingStatus }
      }
    `;

    const response = await keystoneClient(mutation, {
      id: current.data.authenticatedItem.id,
      data: { onboardingStatus: status },
    });

    if (!response.success) {
      return { success: false, error: response.error };
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/(admin)');

    return { success: true, data: response.data?.updateUser };
  } catch (error) {
    console.error('Error updating onboarding status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export async function startOnboarding() {
  return updateOnboardingStatus('in_progress');
}

export async function completeOnboarding() {
  return updateOnboardingStatus('completed');
}

export async function dismissOnboarding() {
  return updateOnboardingStatus('dismissed');
}
