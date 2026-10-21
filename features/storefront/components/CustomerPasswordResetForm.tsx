"use client";

import { useActionState } from "react";
import Link from "next/link";
import { customerPasswordResetAction } from "../lib/data/account";

export function CustomerPasswordResetForm({ token }: { token?: string }) {
  const mode = token ? "reset" : "request";
  const [state, action, pending] = useActionState(customerPasswordResetAction, null);
  const done = Boolean(state?.ok);
  return (
    <section className="mx-auto max-w-md" aria-labelledby="reset-title">
      <h1 id="reset-title" className="sf-display text-3xl">{mode === "reset" ? "Choose a new password" : "Reset your password"}</h1>
      <p className="mt-3 text-sm text-[var(--sf-ink-muted)]">
        {mode === "reset" ? "Enter your account email and a new password." : "Enter the email for your account and we’ll send a reset link."}
      </p>
      {!done ? (
        <form action={action} className="mt-6 grid gap-4">
          <input type="hidden" name="mode" value={mode} />
          {token ? <input type="hidden" name="token" value={token} /> : null}
          <label htmlFor="reset-email" className="grid gap-2">Email<input id="reset-email" name="email" className="sf-field min-h-11" type="email" autoComplete="email" required maxLength={320} /></label>
          {mode === "reset" ? (
            <>
              <label htmlFor="reset-password" className="grid gap-2">New password<input id="reset-password" name="password" className="sf-field min-h-11" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
              <label htmlFor="reset-confirm" className="grid gap-2">Confirm new password<input id="reset-confirm" name="confirm" className="sf-field min-h-11" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
            </>
          ) : null}
          {state && !state.ok ? <p className="sf-alert-error" role="alert">{state.message}</p> : null}
          <button className="sf-btn min-h-11" disabled={pending}>{pending ? "Please wait…" : mode === "reset" ? "Reset password" : "Send reset link"}</button>
        </form>
      ) : (
        <p className="sf-alert-success mt-6" role="status">{state?.message}</p>
      )}
      <p className="mt-6 text-sm">
        <Link href="/account" className="underline underline-offset-4">Back to sign in</Link>
      </p>
    </section>
  );
}
