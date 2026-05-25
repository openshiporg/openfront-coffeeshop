"use client";

import * as React from "react";
import { Gift } from "lucide-react";
import { lookupCafeLoyalty } from "@/features/storefront/lib/data/loyalty";

type Props = {
  email: string;
  orderId?: string;
  secretKey?: string;
  onApplyEmail?: (email: string) => void;
};

export function LoyaltyLookup({ email, orderId, secretKey, onApplyEmail }: Props) {
  const [lookupEmail, setLookupEmail] = React.useState(email);
  const [pending, setPending] = React.useState(false);
  const [account, setAccount] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLookupEmail(email);
  }, [email]);

  async function lookup() {
    if (!lookupEmail.trim()) return;
    setPending(true);
    setError(null);
    const result = await lookupCafeLoyalty(lookupEmail, orderId, secretKey);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setAccount(result.account);
    onApplyEmail?.(lookupEmail);
  }

  return (
    <div className="rounded-lg border border-[#d7c7ad] bg-[#f4ead9] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#201715]">
        <Gift className="h-4 w-4 text-[#8b5f2b]" />
        House rewards
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1 text-sm font-bold text-[#201715]">
          Loyalty email
          <input
            value={lookupEmail}
            onChange={(event) => setLookupEmail(event.target.value)}
            className="w-full rounded-md border border-[#d7c7ad] bg-white px-3 py-2 outline-none focus:border-[#8b5f2b]"
            placeholder="you@example.com"
          />
        </label>
        <button type="button" onClick={lookup} disabled={pending || !lookupEmail.trim() || !orderId || !secretKey} className="rounded-md bg-[#8b5f2b] px-4 py-2 text-sm font-black text-white disabled:opacity-50">
          {pending ? "Checking..." : "Check rewards"}
        </button>
      </div>
      {account ? (
        <div className="mt-3 rounded-md bg-white p-3 text-sm text-[#201715]">
          <div className="font-black">Rewards available for {account.customerEmail}</div>
          <div className="mt-1 text-[#6d5e52]">
            {account.pointsBalance || 0}/100 points toward the next drink / {account.drinkCredits || 0} drink credits available
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#8b5f2b]">Rewards lookup is available after an order is created with its secure confirmation key.</p>
      )}
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
