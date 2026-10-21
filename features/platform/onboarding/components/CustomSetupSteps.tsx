import React, { useId, useState } from 'react';
import { Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DataCard } from './DataCard';
import seedData from '@/features/platform/onboarding/lib/seed.json';
import type { CoffeeSeedData } from '../utils/dataUtils';
import { parseOnboardingData } from '../lib/onboardingSchema';

interface CustomSetupStepsProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onJsonUpdate: (newJson: CoffeeSeedData) => void;
}

function useCopyToClipboard(): [string | null, (text: string) => Promise<boolean>] {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = React.useCallback(async (text: string) => {
    if (!navigator?.clipboard) return false;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      return true;
    } catch {
      setCopiedText(null);
      return false;
    }
  }, []);

  return [copiedText, copy];
}

export function CustomSetupSteps({ draft: customJson, onDraftChange: setCustomJson, onJsonUpdate }: CustomSetupStepsProps) {
  const fieldId = useId();
  const [, copy] = useCopyToClipboard();
  const [copiedItems, setCopiedItems] = useState<Record<string, boolean>>({});
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);
  const [pasteMessage, setPasteMessage] = useState('');
  const setJsonError = (message: string) => setJsonErrors(message ? [message] : []);

  const completeJson = seedData.full;

  const copyToClipboard = async (text: string, itemKey: string) => {
    const success = await copy(text);
    if (!success) return;
    setCopiedItems((prev) => ({ ...prev, [itemKey]: true }));
    setTimeout(() => {
      setCopiedItems((prev) => ({ ...prev, [itemKey]: false }));
    }, 2000);
  };

  const generateAIPrompt = () => {
    return `I need help customizing my coffee shop configuration. I've pasted the base setup JSON.

Start by telling me what this configuration currently contains, then ask me what I want to change.
Only use details I give you for my store name, address, phone, email and sales tax rate (taxRateBasisPoints, e.g. 875 = 8.75%); leave anything you don't know for me to fill in.
When I'm done, return the complete updated JSON so I can paste it back into setup.
Keep the same JSON shape and keys: storeInfo, categories, menuItems, modifiers, inventoryItems, paymentProviders, suppliers, recipes, ingredients, purchaseOrders, staffShifts, loyaltyAccounts, cateringOrders.`;
  };

  const validateAndApplyJson = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(customJson);
    } catch {
      setJsonError('Invalid JSON format. Please check your syntax.');
      return;
    }
    // Same contract the server enforces, so an applied payload is the one setup accepts.
    const result = parseOnboardingData(parsed);
    if (!result.success) {
      setJsonErrors(result.errors);
      return;
    }
    setJsonErrors([]);
    onJsonUpdate(result.data as CoffeeSeedData);
  };

  const steps = [
    {
      number: 1,
      title: 'Copy Base Configuration',
      description: 'Start with the complete coffee shop template JSON configuration.',
      content: (
        <DataCard
          title="Onboarding Data"
          content={JSON.stringify(completeJson, null, 2)}
          onCopy={copyToClipboard}
          copied={copiedItems.json || false}
          copyKey="json"
        />
      ),
    },
    {
      number: 2,
      title: 'Copy AI Customization Prompt',
      description: 'Use this prompt with an AI assistant to customize the coffee setup.',
      content: (
        <DataCard
          title="AI Prompt"
          content={generateAIPrompt()}
          onCopy={copyToClipboard}
          copied={copiedItems.prompt || false}
          copyKey="prompt"
        />
      ),
    },
    {
      number: 3,
      title: 'Paste Your Custom JSON',
      description: 'Paste your configuration, then review it. Confirm stays disabled until it passes validation.',
      content: (
        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted px-4 py-2">
            <Label htmlFor={`${fieldId}-json`} className="text-sm font-medium text-muted-foreground">Custom setup configuration</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Paste configuration from clipboard"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  setCustomJson(text);
                  setJsonError('');
                  setPasteMessage('');
                } catch {
                  setPasteMessage('Clipboard access was blocked. Paste into the box instead.');
                }
              }}
              className="size-11 p-0 hover:bg-background/80"
            >
              <Clipboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Button>
          </div>
          <div className="bg-background">
            <Textarea
              id={`${fieldId}-json`}
              aria-describedby={`${fieldId}-json-status`}
              aria-invalid={jsonErrors.length > 0}
              placeholder="Paste your customized JSON configuration here..."
              value={customJson}
              spellCheck={false}
              onChange={(e) => {
                setCustomJson(e.target.value);
                setJsonError('');
              }}
              className="min-h-[220px] resize-none rounded-none border-0 bg-transparent p-4 font-mono text-xs focus:outline-none"
            />
          </div>
          <div id={`${fieldId}-json-status`} aria-live="polite">
            {pasteMessage ? <p className="px-4 pb-2 text-xs text-muted-foreground">{pasteMessage}</p> : null}
            {jsonErrors.length ? (
              <div className="px-4 pb-4">
                <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2" role="alert">
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-destructive">
                    {jsonErrors.map((message) => <li key={message}>{message}</li>)}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-end border-t bg-muted px-4 py-2">
            <Button type="button" size="sm" className="min-h-11" onClick={validateAndApplyJson} disabled={!customJson.trim()}>
              Review configuration
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Custom Setup Configuration</Label>
        <p className="text-xs text-muted-foreground">
          Copy the base configuration, adjust it (an AI assistant can help), then paste it back and review it before confirming.
        </p>
      </div>

      <div className="space-y-0">
        {steps.map((step, index) => (
          <div key={step.number} className="relative">
            {index < steps.length - 1 ? <div className="absolute bottom-0 left-3 top-3 w-px bg-border" /> : null}
            <div className="relative mb-2 flex items-center space-x-3">
              <div className="z-10 inline-flex size-6 items-center justify-center rounded-sm border border-border bg-background text-sm text-foreground shadow-sm">
                {step.number}
              </div>
              <Label className="text-sm font-medium text-foreground">{step.title}</Label>
            </div>
            <div className="pl-9">
              <div className="pb-6">
                <p className="mb-3 text-xs text-muted-foreground">{step.description}</p>
                {step.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
