"use client";

import { useActionState } from "react";
import { updateCustomerProfileAction } from "../lib/data/account";

export function CustomerProfileForm({ name, phone }: { name: string; phone?: string | null }) {
  const [state, action, pending] = useActionState(updateCustomerProfileAction, null);
  return (
    <form action={action} className="sf-panel sf-form-stack" aria-labelledby="profile-title">
      <h2 id="profile-title" className="sf-display sf-panel-title">Profile</h2>
      <label htmlFor="profile-name" className="sf-form-label">
        Name
        <input id="profile-name" name="name" defaultValue={name} className="sf-field" autoComplete="name" required maxLength={200} />
      </label>
      <label htmlFor="profile-phone" className="sf-form-label">
        <span>Phone <span className="sf-optional">optional</span></span>
        <input id="profile-phone" name="phone" defaultValue={phone || ""} className="sf-field" type="tel" inputMode="tel" autoComplete="tel" maxLength={50} />
      </label>
      <div aria-live="polite">
        {state ? <p className={state.ok ? "sf-alert-success" : "sf-alert-error"} role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
      </div>
      <button className="sf-btn sf-btn-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
