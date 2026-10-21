"use client";

import * as React from "react";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OnboardingStep {
  href: string;
  title: string;
  description: string;
}

type Props = {
  steps: OnboardingStep[];
  onboardingStatus?: string;
  userRole?: { canManageOnboarding?: boolean } | null;
  onDismiss: () => void;
  onOpenDialog?: () => void;
};

export function OnboardingCards({ steps, onboardingStatus, userRole, onDismiss, onOpenDialog }: Props) {
  if (!userRole?.canManageOnboarding) return null;
  if (onboardingStatus === "completed" || onboardingStatus === "dismissed") return null;

  return (
    <div className="w-full">
      {steps.map(({ href, title, description }) => (
        <OnboardingCard key={href} title={title} description={description} onDismiss={onDismiss} onOpenDialog={onOpenDialog} />
      ))}
    </div>
  );
}

function OnboardingCard({ title, description, onDismiss, onOpenDialog }: {
  title: string;
  description: string;
  onDismiss?: () => void;
  onOpenDialog?: () => void;
}) {
  const [isDismissed, setIsDismissed] = React.useState(false);

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <>
      <div
        className={cn(
          "group relative rounded-lg border bg-white transition-all duration-300 ease-spring dark:bg-black group-has-[[data-collapsible=icon]]/sidebar-wrapper:hidden",
          "opacity-100 translate-y-0 hover:shadow-sm"
        )}
      >
        <div className="absolute -right-1.5 -top-1 z-10">
          <div className="h-3 w-3 animate-pulse rounded-full border-3 border-blue-200 bg-blue-700 dark:border-blue-800/50 dark:bg-blue-400" />
        </div>
        <div className="flex items-start">
          <div className="flex flex-col gap-1 px-2 pt-2 text-xs">
            <div className="mb-1 font-medium">{title}</div>
            <div className="leading-4 text-muted-foreground">{description}</div>
          </div>
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <div className="m-2 space-x-2">
            <Button size="sm" onClick={onOpenDialog} className="h-6 text-xs">
              Get started
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-6 text-xs">
              Skip for now
            </Button>
          </div>
        </div>
      </div>

      <div className="relative hidden group-has-[[data-collapsible=icon]]/sidebar-wrapper:block">
        <div className="absolute -right-1.5 -top-1 z-10">
          <div className="h-3 w-3 animate-pulse rounded-full border-3 border-blue-200 bg-blue-700 dark:border-blue-800/50 dark:bg-blue-400" />
        </div>
        <Button variant="outline" size="icon" className="size-8" onClick={onOpenDialog}>
          <Rocket className="size-3" />
        </Button>
      </div>
    </>
  );
}
