import { useRouter } from "next/navigation";
import { ClientError, gql, GraphQLClient } from "graphql-request";

import type { TemplateType } from "../config/templates";
import { getItemsFromJsonData } from "../utils/dataUtils";
import { getOnboardingStatus, refreshAfterOnboarding, startOnboarding } from "../actions/onboarding";
import type { OnboardingOutcome, OnboardingResult } from "./useOnboardingState";

type OnboardingStep = "template" | "progress" | "done";
type CoffeeOnboardingData = Parameters<typeof getItemsFromJsonData>[0];
type Props = {
  selectedTemplate: TemplateType;
  currentJsonData: CoffeeOnboardingData;
  canSubmit: boolean;
  setProgress: (message: string) => void;
  setItemLoading: (type: string, item: string) => void;
  setItemCompleted: (type: string, item: string) => void;
  setItemError: (type: string, item: string, errorMessage: string) => void;
  setStep: (step: OnboardingStep) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setResult: (result: OnboardingResult | null) => void;
  setOutcome: (outcome: OnboardingOutcome) => void;
  resetOnboardingState: () => void;
};

const GRAPHQL_ENDPOINT = "/api/graphql";
const SECTIONS = ["storeInfo", "categories", "menuItems", "modifiers", "inventoryItems", "paymentProviders", "suppliers", "recipes", "ingredients", "purchaseOrders", "staffShifts", "loyaltyAccounts", "cateringOrders"] as const;

/**
 * A GraphQL error from the setup mutation itself means the server rejected it
 * and the single transaction rolled back. Timeouts, server failures and lost
 * responses leave the outcome unknown until it is checked.
 */
function classify(error: unknown): { kind: "rejected"; message: string } | { kind: "unknown" } {
  if (error instanceof ClientError) {
    const errors = error.response.errors ?? [];
    const timedOut = errors.some((entry) => (entry.extensions as { code?: string } | undefined)?.code === "GRAPHQL_TIMEOUT");
    if (errors.length && !timedOut && error.response.status < 500) {
      return { kind: "rejected", message: errors[0]?.message || "Setup was rejected" };
    }
  }
  return { kind: "unknown" };
}

export function useOnboardingApi({
  selectedTemplate,
  currentJsonData,
  canSubmit,
  setProgress,
  setItemLoading,
  setItemCompleted,
  setItemError,
  setStep,
  setError,
  setIsLoading,
  setResult,
  setOutcome,
  resetOnboardingState,
}: Props) {
  const router = useRouter();

  const runOnboarding = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    resetOnboardingState();
    setStep("progress");
    setProgress("Applying your coffee shop setup…");

    const sectionItems = Object.fromEntries(
      SECTIONS.map((section) => [section, getItemsFromJsonData(currentJsonData, section)]),
    ) as Record<(typeof SECTIONS)[number], string[]>;
    const markAll = (mark: (section: string, item: string) => void) => {
      for (const section of SECTIONS) for (const item of sectionItems[section]) mark(section, item);
    };
    markAll(setItemLoading);

    const started = await startOnboarding();

    try {
      const client = new GraphQLClient(GRAPHQL_ENDPOINT, {
        headers: { "Content-Type": "application/json" },
      });
      const response = await client.request<{ runCoffeeOnboarding: OnboardingResult }>(
        gql`
          mutation RunCoffeeOnboarding($template: String!, $data: JSON) {
            runCoffeeOnboarding(template: $template, data: $data) {
              status
              storeSettings
              categories
              menuItems
              modifiers
              inventoryItems
              paymentProviders
              suppliers
              recipes
              ingredients
              purchaseOrders
              staffShifts
              loyaltyAccounts
              cateringOrders
            }
          }
        `,
        {
          template: selectedTemplate,
          data: selectedTemplate === "custom" ? currentJsonData : null,
        },
      );
      if (response.runCoffeeOnboarding.status !== "completed") throw new Error("Setup did not complete");

      markAll(setItemCompleted);
      setResult(response.runCoffeeOnboarding);
      setOutcome("completed");
      setProgress("Setup saved.");
      setStep("done");
      await refreshAfterOnboarding();
      router.refresh();
    } catch (error) {
      const classified = classify(error);
      if (classified.kind === "rejected") {
        markAll((section, item) => setItemError(section, item, classified.message));
        setOutcome("rejected");
        setError(`${classified.message}. Nothing was saved; correct the setup and try again.`);
        setProgress("Setup was not saved.");
        setStep("template");
        return;
      }

      // Outcome unknown: check the durable status the setup transaction records on commit.
      const status = await getOnboardingStatus();
      if (status === "completed" && started.previousStatus !== "completed") {
        markAll(setItemCompleted);
        setOutcome("reconciled");
        setProgress("Setup saved.");
        setStep("done");
        await refreshAfterOnboarding();
        router.refresh();
        return;
      }
      setOutcome("unknown");
      setError("We couldn't confirm whether setup finished. Reload the dashboard to check before trying again — running setup again never replaces records that already exist.");
      setProgress("Setup status unknown.");
      setStep("template");
    } finally {
      setIsLoading(false);
    }
  };

  return { runOnboarding };
}
