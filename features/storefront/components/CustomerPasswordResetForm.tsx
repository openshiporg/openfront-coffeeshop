"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { customerPasswordResetAction } from "../lib/data/account";

export function CustomerPasswordResetForm({ token }: { token?: string }) {
  const mode = token ? "reset" : "request";
  const [state, action, pending] = useActionState(customerPasswordResetAction, null);
  const done = Boolean(state?.ok);
  return (
    <section className="sf-auth" aria-labelledby="reset-title">
      <Link href="/account" className="sf-back-link">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Sign in
      </Link>
      <div className="sf-panel">
        <h1 id="reset-title" className="sf-display sf-page-title">{mode === "reset" ? "Choose a new password" : "Reset password"}</h1>
        {!done ? (
          <form action={action} className="sf-form-stack">
            <input type="hidden" name="mode" value={mode} />
            {token ? <input type="hidden" name="token" value={token} /> : null}
            <label htmlFor="reset-email" className="sf-form-label">Email<input id="reset-email" name="email" className="sf-field" type="email" autoComplete="email" required maxLength={320} /></label>
            {mode === "reset" ? (
              <>
                <label htmlFor="reset-password" className="sf-form-label">
                  <span>New password <span className="sf-optional">at least 12 characters</span></span>
                  <input id="reset-password" name="password" className="sf-field" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
                </label>
                <label htmlFor="reset-confirm" className="sf-form-label">Confirm new password<input id="reset-confirm" name="confirm" className="sf-field" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
              </>
            ) : null}
            {state && !state.ok ? <p className="sf-alert-error" role="alert">{state.message}</p> : null}
            <button className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block" disabled={pending}>{pending ? "Please wait…" : mode === "reset" ? "Reset password" : "Send reset link"}</button>
          </form>
        ) : (
          <p className="sf-alert-success" role="status">{state?.message}</p>
        )}
      </div>
    </section>
  );
}
