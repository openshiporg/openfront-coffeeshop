import React, { useState } from 'react';
import { ArrowLeft, Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DataCard } from './DataCard';
import seedData from '@/features/platform/onboarding/lib/seed.json';

interface CustomSetupStepsProps {
  currentJson?: any;
  onJsonUpdate?: (newJson: any) => void;
  onBack?: () => void;
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

export function CustomSetupSteps({ onJsonUpdate = () => {}, onBack }: CustomSetupStepsProps) {
  const [, copy] = useCopyToClipboard();
  const [copiedItems, setCopiedItems] = useState<Record<string, boolean>>({});
  const [customJson, setCustomJson] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [jsonApplied, setJsonApplied] = useState(false);

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

Start by telling me what this configuration currently contains for store info, categories, menu items, modifiers, and inventory.
Then ask me what I want to change.
When I'm done, return the complete updated JSON so I can paste it back into onboarding.
Keep the same JSON shape with these top-level keys: storeInfo, categories, menuItems, modifiers, inventoryItems.`;
  };

  const validateAndApplyJson = () => {
    try {
      const parsed = JSON.parse(customJson);
      const requiredKeys = ['storeInfo', 'categories', 'menuItems', 'modifiers', 'inventoryItems'];
      const missingKeys = requiredKeys.filter((key) => {
        if (key === 'storeInfo') return !parsed[key] || typeof parsed[key] !== 'object';
        return !parsed[key] || !Array.isArray(parsed[key]);
      });

      if (missingKeys.length > 0) {
        setJsonError(`Missing required keys: ${missingKeys.join(', ')}`);
        return;
      }

      onJsonUpdate(parsed);
      setJsonApplied(true);
      setJsonError('');
    } catch {
      setJsonError('Invalid JSON format. Please check your syntax.');
    }
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
      description: 'Paste the AI-generated configuration here.',
      content: (
        <div className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted px-4 py-2">
            <span className="text-sm font-medium text-muted-foreground">Custom Onboarding Data</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  setCustomJson(text);
                  setJsonError('');
                } catch {
                  // ignore
                }
              }}
              className="h-6 w-6 p-0 hover:bg-background/80"
            >
              <Clipboard className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
          <div className="bg-background">
            <Textarea
              placeholder="Paste your customized JSON configuration here..."
              value={customJson}
              onChange={(e) => {
                setCustomJson(e.target.value);
                setJsonError('');
              }}
              className="min-h-[220px] resize-none rounded-none border-0 bg-transparent p-4 font-mono text-xs focus:outline-none"
            />
          </div>
          {jsonError ? (
            <div className="px-4 pb-4">
              <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2">
                <p className="text-xs text-destructive">{jsonError}</p>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-end border-t bg-muted px-4 py-2">
            <Button size="sm" onClick={validateAndApplyJson} disabled={!customJson.trim()}>
              Apply Configuration
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {jsonApplied && onBack ? (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setJsonApplied(false);
              onBack();
            }}
            className="h-8 px-2"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Custom Setup
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label className="text-sm font-medium">Custom Setup Configuration</Label>
        <p className="text-xs text-muted-foreground">
          Follow these steps to create a personalized coffee shop setup using AI assistance.
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
