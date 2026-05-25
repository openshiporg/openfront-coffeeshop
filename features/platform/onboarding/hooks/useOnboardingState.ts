import { useEffect, useState } from 'react';
import seedData from '../lib/seed.json';
import { STORE_TEMPLATES } from '../config/templates';
import { getItemsFromJsonData, getSeedForTemplate } from '../utils/dataUtils';

export type OnboardingStep = 'template' | 'progress' | 'done';
export type TemplateType = 'full' | 'minimal' | 'custom';

const initialItemsState = {
  storeInfo: [],
  categories: [],
  menuItems: [],
  modifiers: [],
  inventoryItems: [],
  paymentProviders: [],
};

export function useOnboardingState() {
  const [step, setStep] = useState<OnboardingStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('full');
  const [currentJsonData, setCurrentJsonData] = useState<any>(null);
  const [customJsonApplied, setCustomJsonApplied] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [loadingItems, setLoadingItemsState] = useState<Record<string, string[]>>({ ...initialItemsState });
  const [completedItems, setCompletedItemsState] = useState<Record<string, string[]>>({ ...initialItemsState });
  const [itemErrors, setItemErrorsState] = useState<Record<string, Record<string, string | undefined>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const data = getSeedForTemplate(selectedTemplate, seedData);
    setCurrentJsonData(data);
    setCustomJsonApplied(false);
  }, [selectedTemplate]);

  const setProgress = (message: string) => {
    setProgressMessage(message);
  };

  const setItemLoading = (type: string, item: string) => {
    setLoadingItemsState((prev) => ({
      ...prev,
      [type]: [...(prev[type] || []), item],
    }));
    setItemErrorsState((prev) => ({
      ...prev,
      [type]: {
        ...(prev[type] || {}),
        [item]: undefined,
      },
    }));
  };

  const setItemCompleted = (type: string, item: string) => {
    setLoadingItemsState((prev) => ({
      ...prev,
      [type]: (prev[type] || []).filter((entry) => entry !== item),
    }));
    setCompletedItemsState((prev) => ({
      ...prev,
      [type]: Array.from(new Set([...(prev[type] || []), item])),
    }));
    setItemErrorsState((prev) => ({
      ...prev,
      [type]: {
        ...(prev[type] || {}),
        [item]: undefined,
      },
    }));
  };

  const setItemError = (type: string, item: string, errorMessage: string) => {
    setLoadingItemsState((prev) => ({
      ...prev,
      [type]: (prev[type] || []).filter((entry) => entry !== item),
    }));
    setItemErrorsState((prev) => ({
      ...prev,
      [type]: {
        ...(prev[type] || {}),
        [item]: errorMessage,
      },
    }));
  };

  const resetOnboardingState = () => {
    setError(null);
    setItemErrorsState({});
    setLoadingItemsState({ ...initialItemsState });
    setCompletedItemsState({ ...initialItemsState });
  };

  return {
    step,
    selectedTemplate,
    currentJsonData,
    customJsonApplied,
    progressMessage,
    loadingItems,
    completedItems,
    itemErrors,
    error,
    isLoading,
    setStep,
    setSelectedTemplate,
    setCurrentJsonData,
    setCustomJsonApplied,
    setProgress,
    setItemLoading,
    setItemCompleted,
    setItemError,
    setError,
    setIsLoading,
    resetOnboardingState,
    getDisplayNamesFromData: (data: any) => ({
      storeInfo: getItemsFromJsonData(data, 'storeInfo'),
      categories: getItemsFromJsonData(data, 'categories'),
      menuItems: getItemsFromJsonData(data, 'menuItems'),
      modifiers: getItemsFromJsonData(data, 'modifiers'),
      inventoryItems: getItemsFromJsonData(data, 'inventoryItems'),
      paymentProviders: getItemsFromJsonData(data, 'paymentProviders'),
    }),
    templateDisplayNames: STORE_TEMPLATES[selectedTemplate].displayNames,
  };
}
