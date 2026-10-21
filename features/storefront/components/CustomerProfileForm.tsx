"use client";

import { useActionState } from "react";
import { updateCustomerProfileAction } from "../lib/data/account";

export function CustomerProfileForm({ name, phone }: { name: string; phone?: string | null }) {
  const [state, action, pending] = useActionState(updateCustomerProfileAction, null);
  return (
    <form action={action} className="sf-panel grid gap-4" aria-labelledby="profile-title">
      <h2 id="profile-title" className="sf-display text-2xl">Profile</h2>
      <label htmlFor="profile-name" className="grid gap-2 text-sm font-medium">
        Name
        <input id="profile-name" name="name" defaultValue={name} className="sf-field min-h-11" autoComplete="name" required maxLength={200} />
      </label>
      <label htmlFor="profile-phone" className="grid gap-2 text-sm font-medium">
        Phone (optional)
        <input id="profile-phone" name="phone" defaultValue={phone || ""} className="sf-field min-h-11" type="tel" inputMode="tel" autoComplete="tel" maxLength={50} />
      </label>
      <div aria-live="polite">
        {state ? <p className={state.ok ? "sf-alert-success" : "sf-alert-error"} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
      </div>
      <button className="sf-btn min-h-11" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
