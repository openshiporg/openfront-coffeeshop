import { GraphQLClient, gql } from 'graphql-request';
import { startOnboarding, completeOnboarding } from '../actions/onboarding';
import { TemplateType } from '../config/templates';
import { getModifierDisplayName } from '../utils/dataUtils';

type OnboardingStep = 'template' | 'progress' | 'done';

type Props = {
  selectedTemplate: TemplateType;
  currentJsonData: any;
  setProgress: (message: string) => void;
  setItemLoading: (type: string, item: string) => void;
  setItemCompleted: (type: string, item: string) => void;
  setItemError: (type: string, item: string, errorMessage: string) => void;
  setStep: (step: OnboardingStep) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  resetOnboardingState: () => void;
};

const GRAPHQL_ENDPOINT = '/api/graphql';

async function findExisting(client: GraphQLClient, query: string, variables: any, path: string) {
  const result: any = await client.request(query, variables);
  return result?.[path]?.[0] || null;
}

export function useOnboardingApi({
  selectedTemplate,
  currentJsonData,
  setProgress,
  setItemLoading,
  setItemCompleted,
  setItemError,
  setStep,
  setError,
  setIsLoading,
  resetOnboardingState,
}: Props) {
  async function runOnboarding() {
    setIsLoading(true);
    setError(null);
    resetOnboardingState();
    setStep('progress');
    setProgress('Starting coffee shop setup...');

    try {
      await startOnboarding();
    } catch (error) {
      console.error('Error marking onboarding started:', error);
    }

    const client = new GraphQLClient(GRAPHQL_ENDPOINT, { headers: { 'Content-Type': 'application/json' } });
    const data = currentJsonData;
    const categoryIds: Record<string, string> = {};
    const menuItemIds: Record<string, string> = {};

    try {
      if (data.storeInfo) {
        setItemLoading('storeInfo', data.storeInfo.name || 'Store information');
        setItemCompleted('storeInfo', data.storeInfo.name || 'Store information');
      }

      setProgress('Creating menu categories...');
      for (const category of data.categories || []) {
        setItemLoading('categories', category.name);
        try {
          const existing = await findExisting(
            client,
            gql`query CategoryByName($name: String!) { menuCategories(where: { name: { equals: $name } }, take: 1) { id name } }`,
            { name: category.name },
            'menuCategories'
          );

          if (existing?.id) {
            categoryIds[category.name] = existing.id;
          } else {
            const result: any = await client.request(
              gql`mutation CreateMenuCategory($data: MenuCategoryCreateInput!) { createMenuCategory(data: $data) { id name } }`,
              { data: { name: category.name, description: category.description, sortOrder: category.sortOrder, active: true } }
            );
            categoryIds[category.name] = result.createMenuCategory.id;
          }
          setItemCompleted('categories', category.name);
        } catch (error: any) {
          setItemError('categories', category.name, error.message || 'Failed to create category');
        }
      }

      setProgress('Creating coffee menu...');
      for (const item of data.menuItems || []) {
        setItemLoading('menuItems', item.name);
        try {
          const existing = await findExisting(
            client,
            gql`query MenuItemByName($name: String!) { menuItems(where: { name: { equals: $name } }, take: 1) { id name } }`,
            { name: item.name },
            'menuItems'
          );

          let menuItemId = existing?.id;
          if (!menuItemId) {
            const { categoryName, ...itemData } = item;
            const result: any = await client.request(
              gql`mutation CreateMenuItem($data: MenuItemCreateInput!) { createMenuItem(data: $data) { id name } }`,
              {
                data: {
                  ...itemData,
                  available: true,
                  category: categoryIds[categoryName] ? { connect: { id: categoryIds[categoryName] } } : undefined,
                },
              }
            );
            menuItemId = result.createMenuItem.id;
          }

          if (menuItemId) {
            menuItemIds[item.name] = menuItemId;
          }
          setItemCompleted('menuItems', item.name);
        } catch (error: any) {
          setItemError('menuItems', item.name, error.message || 'Failed to create menu item');
        }
      }

      setProgress('Creating coffee modifiers...');
      for (const modifier of data.modifiers || []) {
        const modifierDisplayName = getModifierDisplayName(modifier);
        setItemLoading('modifiers', modifierDisplayName);
        try {
          const menuItemId = menuItemIds[modifier.menuItemName];
          if (!menuItemId) {
            throw new Error(`Menu item not found for modifier: ${modifier.menuItemName}`);
          }

          const existingModifier = await findExisting(
            client,
            gql`query ModifierByName($name: String!, $menuItemId: ID!) { menuItemModifiers(where: { name: { equals: $name }, menuItem: { id: { equals: $menuItemId } } }, take: 1) { id name } }`,
            { name: modifier.name, menuItemId },
            'menuItemModifiers'
          );

          if (!existingModifier?.id) {
            await client.request(
              gql`mutation CreateModifier($data: MenuItemModifierCreateInput!) { createMenuItemModifier(data: $data) { id name } }`,
              {
                data: {
                  ...modifier,
                  inStock: true,
                  menuItem: { connect: { id: menuItemId } },
                },
              }
            );
          }
          setItemCompleted('modifiers', modifierDisplayName);
        } catch (error: any) {
          setItemError('modifiers', modifierDisplayName, error.message || 'Failed to create modifier');
        }
      }

      setProgress('Creating inventory par levels...');
      for (const inventoryItem of data.inventoryItems || []) {
        setItemLoading('inventoryItems', inventoryItem.name);
        try {
          const existing = await findExisting(
            client,
            gql`query InventoryByName($name: String!) { inventoryItems(where: { name: { equals: $name } }, take: 1) { id name } }`,
            { name: inventoryItem.name },
            'inventoryItems'
          );
          if (!existing?.id) {
            await client.request(
              gql`mutation CreateInventoryItem($data: InventoryItemCreateInput!) { createInventoryItem(data: $data) { id name } }`,
              { data: inventoryItem }
            );
          }
          setItemCompleted('inventoryItems', inventoryItem.name);
        } catch (error: any) {
          setItemError('inventoryItems', inventoryItem.name, error.message || 'Failed to create inventory item');
        }
      }

      setProgress('Creating payment providers...');
      for (const paymentProvider of data.paymentProviders || []) {
        setItemLoading('paymentProviders', paymentProvider.name);
        try {
          const existing = await findExisting(
            client,
            gql`query PaymentProviderByCode($code: String!) { paymentProviders(where: { code: { equals: $code } }, take: 1) { id code } }`,
            { code: paymentProvider.code },
            'paymentProviders'
          );

          if (!existing?.id) {
            await client.request(
              gql`mutation CreatePaymentProvider($data: PaymentProviderCreateInput!) { createPaymentProvider(data: $data) { id code } }`,
              { data: paymentProvider }
            );
          }
          setItemCompleted('paymentProviders', paymentProvider.name);
        } catch (error: any) {
          setItemError('paymentProviders', paymentProvider.name, error.message || 'Failed to create payment provider');
        }
      }

      setProgress('Coffee shop setup complete.');
      await completeOnboarding();
      setStep('done');
    } catch (error: any) {
      setError(error.message || 'Onboarding failed');
      console.error('Error during onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return { runOnboarding };
}
