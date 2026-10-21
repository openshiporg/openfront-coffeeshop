'use client';

import React from 'react';
import { AlertCircle, ArrowUpRight, CircleCheck, Coffee, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge-button';
import { CustomSetupSteps } from './CustomSetupSteps';
import { SectionRenderer } from './SectionRenderer';
import { useOnboardingState } from '../hooks/useOnboardingState';
import { useOnboardingApi } from '../hooks/useOnboardingApi';
import { SECTION_DEFINITIONS } from '../config/templates';

interface OnboardingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const TEMPLATE_ICONS = {
  minimal: <Package className="h-5 w-5" />,
  full: <Coffee className="h-5 w-5" />,
  custom: <CircleCheck className="h-5 w-5" />,
} as const;

export default function OnboardingDialog({ isOpen, onClose }: OnboardingDialogProps) {
  const onboardingState = useOnboardingState();
  const {
    step,
    selectedTemplate,
    currentJsonData,
    customJsonApplied,
    progressMessage,
    loadingItems,
    completedItems,
    error,
    itemErrors,
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
  } = onboardingState;

  // Custom setup can only be confirmed after its payload was validated and reviewed.
  const canConfirm = selectedTemplate !== 'custom' || customJsonApplied;

  const { runOnboarding } = useOnboardingApi({
    selectedTemplate,
    currentJsonData,
    canSubmit: canConfirm,
    setResult,
    setOutcome,
    setProgress,
    setItemLoading,
    setItemCompleted,
    setItemError,
    setStep,
    setError,
    setIsLoading,
    resetOnboardingState,
  });

  if (!isOpen) return null;

  const summary = (label: string, singular: string, plural: string, count: number | undefined) => (
    <div className="flex items-center space-x-2 text-muted-foreground">
      <CircleCheck className="h-4 w-4 fill-muted-foreground text-background" aria-hidden />
      <span className="font-medium">
        {count === undefined ? label : `${count} ${count === 1 ? singular : plural} added`}
      </span>
    </div>
  );

  const errorBanner = error && !isLoading && step !== 'done' ? (
    <Badge color="rose" className="gap-3 rounded-none border-b text-sm" role="alert">
      <AlertCircle className="size-4 shrink-0 sm:size-5" aria-hidden />
      <span className="text-xs sm:text-sm">{error}</span>
    </Badge>
  ) : null;

  return (
    // Closing is held while setup is running so its outcome is never abandoned mid-flight.
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isLoading) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="flex max-h-[calc(100dvh-2rem)] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="mb-0 shrink-0 border-b px-4 py-4 sm:px-6">
          <DialogTitle>Coffee Shop Setup</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="order-1 flex min-h-0 shrink-0 flex-col overflow-hidden lg:order-none lg:w-80 lg:justify-between lg:border-r">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="flex items-center space-x-3">
                  <div className="inline-flex shrink-0 items-center justify-center rounded-sm bg-muted p-3">
                    <Coffee className="size-5 text-foreground" aria-hidden />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-medium text-foreground">Cafe Setup</h3>
                    <p className="text-sm text-muted-foreground">
                      {step === 'done' ? 'Your coffee shop is ready' : 'Configure your coffee shop operating data'}
                    </p>
                  </div>
                </div>
                <Separator className="my-4" />

                {step === 'done' ? (
                  <>
                    <h4 className="mb-2 text-sm font-medium text-foreground">Setup Complete</h4>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Review Store Settings to confirm your business details, sales tax rate and hours, and count your opening stock before taking orders.
                    </p>
                    <div className="mb-4 flex items-center space-x-2 text-sm text-emerald-600 dark:text-emerald-500" role="status">
                      <CircleCheck className="h-4 w-4 fill-emerald-500 text-background" aria-hidden />
                      <span>Setup saved</span>
                    </div>

                    {outcome === 'reconciled' || !result ? (
                      <p className="text-sm text-muted-foreground">
                        Setup finished, but the confirmation was interrupted, so the number of records added is not available. Existing records were kept as they were.
                      </p>
                    ) : (
                      <div className="space-y-3 text-sm">
                        {summary('', 'category', 'categories', result.categories)}
                        {summary('', 'menu item', 'menu items', result.menuItems)}
                        {summary('', 'modifier', 'modifiers', result.modifiers)}
                        {summary('', 'inventory item', 'inventory items', result.inventoryItems)}
                        <p className="text-xs text-muted-foreground">Records that already existed were kept unchanged and are not counted.</p>
                      </div>
                    )}
                  </>
                ) : !isLoading ? (
                  <>
                    <h4 className="mb-4 text-sm font-medium text-foreground">Setup Type</h4>

                    <div className="block lg:hidden">
                      <Select value={selectedTemplate} onValueChange={(value) => setSelectedTemplate(value as 'minimal' | 'full' | 'custom')}>
                        <SelectTrigger className="h-auto w-full py-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimal">
                            <div className="flex flex-col items-start text-left">
                              <span className="font-medium">Basic Setup</span>
                              <span className="text-xs text-muted-foreground">A few drinks, pastries and pantry items</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="full">
                            <div className="flex flex-col items-start text-left">
                              <span className="font-medium">Complete Setup</span>
                              <span className="text-xs text-muted-foreground">Full menu, modifiers, and inventory</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="custom">
                            <div className="flex flex-col items-start text-left">
                              <span className="font-medium">Custom Setup</span>
                              <span className="text-xs text-muted-foreground">Paste and review your own configuration</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="hidden lg:block">
                      <RadioGroup
                        value={selectedTemplate}
                        onValueChange={(value) => setSelectedTemplate(value as 'minimal' | 'full' | 'custom')}
                        className="space-y-4"
                      >
                        {([
                          ['minimal', 'Basic Setup', 'A few drinks, pastries and pantry items'],
                          ['full', 'Complete Setup', 'Full menu, modifiers, and inventory'],
                          ['custom', 'Custom Setup', 'Paste and review your own configuration'],
                        ] as const).map(([value, title, description]) => (
                          <div
                            key={value}
                            className={`cursor-pointer rounded-md border p-4 transition-colors ${
                              selectedTemplate === value ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'hover:border-blue-200'
                            }`}
                            onClick={() => setSelectedTemplate(value)}
                          >
                            <div className="flex gap-4">
                              <div className={`mt-[3px] flex-shrink-0 ${selectedTemplate === value ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
                                {TEMPLATE_ICONS[value]}
                              </div>
                              <div className="flex-1">
                                <RadioGroupItem value={value} id={value} className="sr-only" />
                                <Label htmlFor={value} className="flex-1 cursor-pointer">
                                  <div className="mb-1 text-base font-medium">{title}</div>
                                  <div className="text-sm text-muted-foreground">{description}</div>
                                </Label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="text-sm font-medium text-foreground">Creating {selectedTemplate === 'minimal' ? 'Basic' : selectedTemplate === 'custom' ? 'Custom' : 'Complete'} Setup</h4>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{progressMessage}</p>
                  </>
                )}
              </div>
            </div>

            <div className="hidden flex-col border-t lg:flex">
              {errorBanner}

              <div className="flex items-center justify-between p-4">
                {step === 'done' ? (
                  <div className="flex w-full flex-col gap-2 sm:flex-row">
                    <DialogClose asChild>
                      <Button type="button" variant="outline" className="w-full sm:w-auto">
                        Close
                      </Button>
                    </DialogClose>
                    <Button asChild className="w-full sm:w-auto">
                      <a href="/" target="_blank" rel="noopener noreferrer">
                        View your storefront
                        <ArrowUpRight className="ml-1.5 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="flex w-full flex-col gap-2 sm:flex-row">
                    <DialogClose asChild>
                      <Button type="button" variant="ghost" disabled={isLoading} className="w-full sm:w-auto">
                        Cancel
                      </Button>
                    </DialogClose>
                    {isLoading ? (
                      <Button disabled className="w-full sm:w-auto">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </Button>
                    ) : (
                      <Button type="button" onClick={runOnboarding} disabled={!canConfirm} className="w-full sm:w-auto">
                        Confirm
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="order-2 min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:order-none">
            {selectedTemplate === 'custom' && step !== 'done' && !isLoading && !customJsonApplied ? (
              <CustomSetupSteps
                draft={customDraft}
                onDraftChange={setCustomDraft}
                onJsonUpdate={(newJsonData) => {
                  setCurrentJsonData(newJsonData);
                  setCustomJsonApplied(true);
                }}
              />
            ) : (
              <>
              {selectedTemplate === 'custom' && step !== 'done' && !isLoading ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <span>Review the configuration below, then confirm.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => {
                      setCustomJsonApplied(false);
                      setCurrentJsonData({});
                    }}
                  >
                    Edit configuration
                  </Button>
                </div>
              ) : null}
              <SectionRenderer
                sections={[...SECTION_DEFINITIONS]}
                selectedTemplate={selectedTemplate}
                isLoading={isLoading}
                loadingItems={loadingItems}
                completedItems={completedItems}
                itemErrors={itemErrors}
                error={error}
                step={step}
                currentJsonData={currentJsonData}
              />
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col border-t lg:hidden">
          {errorBanner}

          <div className="flex items-center justify-between p-4">
            {step === 'done' ? (
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="flex-1">
                    Close
                  </Button>
                </DialogClose>
                <Button asChild className="flex-1">
                  <a href="/" target="_blank" rel="noopener noreferrer">
                    View your storefront
                    <ArrowUpRight className="ml-1.5 h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <DialogClose asChild>
                  <Button type="button" variant="ghost" disabled={isLoading} className="flex-1">
                    Cancel
                  </Button>
                </DialogClose>
                {isLoading ? (
                  <Button disabled className="flex-1">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </Button>
                ) : (
                  <Button type="button" onClick={runOnboarding} disabled={!canConfirm} className="flex-1">
                    Confirm
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
