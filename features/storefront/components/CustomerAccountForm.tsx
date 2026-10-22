"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { customerAccountAction } from "../lib/data/account";

export function CustomerAccountForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, action, pending] = useActionState(customerAccountAction, null);
  return (
    <section className="sf-auth sf-panel" aria-labelledby="account-title">
      <h1 id="account-title" className="sf-display text-2xl">{mode === "login" ? "Sign in" : "Create account"}</h1>
      <div className="sf-track sf-track-fill sf-track-lg mt-5 w-full" role="group" aria-label="Account mode">
        {(["login", "register"] as const).map((value) => (
          <button key={value} type="button" disabled={pending} className="sf-track-item" aria-pressed={mode === value} onClick={() => setMode(value)}>
            {value === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form action={action} className="mt-5 grid gap-4">
        <input type="hidden" name="mode" value={mode} />
        {mode === "register" ? <label className="sf-form-label">Name<input name="name" className="sf-field" autoComplete="name" required maxLength={200} /></label> : null}
        <label className="sf-form-label">Email<input name="email" className="sf-field" type="email" autoComplete="email" required maxLength={320} /></label>
        <label className="sf-form-label">
          <span>Password{mode === "register" ? <span className="font-normal text-[var(--sf-ink-faint)]"> · 12+ characters</span> : null}</span>
          <input name="password" className="sf-field" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 12 : 1} maxLength={128} />
        </label>
        {error ? <p className="sf-alert-error" role="alert">{error}</p> : null}
        <button className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block" disabled={pending}>{pending ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
      </form>
      {mode === "login" ? <p className="mt-2 text-sm"><Link href="/account/reset" className="sf-link">Forgot password?</Link></p> : null}
    </section>
  );
}
