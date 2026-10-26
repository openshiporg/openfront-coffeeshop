"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PlatformSection } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { setOnlinePaymentEnabled } from "../actions/online-payment";

export function OnlinePaymentSetting({ providerId, enabled, keysPresent, canManage }: { providerId: string | null; enabled: boolean; keysPresent: boolean; canManage: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const live = enabled && keysPresent;

  async function toggle(next: boolean) {
    if (!providerId || pending) return;
    setPending(true);
    setError(null);
    const result = await setOnlinePaymentEnabled(providerId, next);
    setPending(false);
    if (!result.success) setError(result.error);
    else router.refresh();
  }

  return (
    <PlatformSection
      id="online-payment-title"
      title="Payments"
      meta={<span className="inline-flex items-center gap-1.5"><StatusDot tone={live ? "green" : "zinc"} />{live ? "Card payments on" : "Pay at pickup only"}</span>}
    >
      <div className="space-y-2 rounded-[6px] border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="online-payment-switch" className="text-sm font-medium">Online card payments</Label>
          <Switch id="online-payment-switch" checked={enabled} disabled={!canManage || !providerId || pending} onCheckedChange={(next) => void toggle(next)} />
        </div>
        {!providerId ? <p className="text-sm text-muted-foreground">Stripe provider not set up</p> : null}
        {enabled && !keysPresent ? <p className="text-sm text-amber-700 dark:text-amber-400">Stripe keys missing on the server</p> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </div>
    </PlatformSection>
  );
}
