import { useState } from 'react';
import seedData from '../lib/seed.json';
import { STORE_TEMPLATES } from '../config/templates';
import { getItemsFromJsonData, getSeedForTemplate, type CoffeeSeedData } from '../utils/dataUtils';

export type OnboardingStep = 'template' | 'progress' | 'done';
export type TemplateType = 'full' | 'minimal' | 'custom';
export type OnboardingOutcome = 'completed' | 'reconciled' | 'rejected' | 'unknown' | null;
export type OnboardingResult = {
  status: string;
  storeSettings: number;
  categories: number;
  menuItems: number;
  modifiers: number;
  inventoryItems: number;
  paymentProviders: number;
  suppliers: number;
  recipes: number;
  ingredients: number;
  purchaseOrders: number;
  staffShifts: number;
  loyaltyAccounts: number;
  cateringOrders: number;
};

const CUSTOM_DRAFT_KEY = 'coffee-onboarding-custom-draft';

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
  const [selectedTemplate, setSelectedTemplateState] = useState<TemplateType>('full');
  const [currentJsonData, setCurrentJsonData] = useState<CoffeeSeedData>(() => getSeedForTemplate('full', seedData as Parameters<typeof getSeedForTemplate>[1]));
  const [customJsonApplied, setCustomJsonApplied] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [loadingItems, setLoadingItemsState] = useState<Record<string, string[]>>({ ...initialItemsState });
  const [completedItems, setCompletedItemsState] = useState<Record<string, string[]>>({ ...initialItemsState });
  const [itemErrors, setItemErrorsState] = useState<Record<string, Record<string, string | undefined>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [outcome, setOutcome] = useState<OnboardingOutcome>(null);
  // The custom draft survives closing the dialog or reloading the tab.
  const [customDraft, setCustomDraftState] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return window.sessionStorage.getItem(CUSTOM_DRAFT_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const setCustomDraft = (value: string) => {
    setCustomDraftState(value);
    try {
      if (value) window.sessionStorage.setItem(CUSTOM_DRAFT_KEY, value);
      else window.sessionStorage.removeItem(CUSTOM_DRAFT_KEY);
    } catch {
      // Storage unavailable; the draft lives in memory only.
    }
  };

  const setSelectedTemplate = (template: TemplateType) => {
    setSelectedTemplateState(template);
    setCurrentJsonData(getSeedForTemplate(template, seedData as Parameters<typeof getSeedForTemplate>[1]));
    setCustomJsonApplied(false);
  };

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
    setResult(null);
    setOutcome(null);
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
    result,
    setResult,
    outcome,
    setOutcome,
    customDraft,
    setCustomDraft,
    getDisplayNamesFromData: (data: CoffeeSeedData) => ({
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
