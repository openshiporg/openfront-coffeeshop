"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { customerAccountAction } from "../lib/data/account";

export function CustomerAccountForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, action, pending] = useActionState(customerAccountAction, null);
  return (
    <section className="mx-auto max-w-md">
      <h1 className="sf-display text-3xl">Your account</h1>
      <div className="my-6 flex rounded-full border border-[var(--sf-rule)] bg-[var(--sf-paper-inset)] p-1" role="group" aria-label="Account mode">
        {(["login", "register"] as const).map((value) => <button key={value} type="button" disabled={pending} className={`min-h-11 flex-1 rounded-full px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sf-focus)] ${mode === value ? "bg-[var(--sf-ink)] font-semibold text-[var(--sf-paper)]" : "text-[var(--sf-ink-muted)]"}`} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === "login" ? "Sign in" : "Create account"}</button>)}
      </div>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="mode" value={mode} />
        {mode === "register" ? <label className="grid gap-2">Name<input name="name" className="sf-field min-h-11" autoComplete="name" required maxLength={200} /></label> : null}
        <label className="grid gap-2">Email<input name="email" className="sf-field min-h-11" type="email" autoComplete="email" required maxLength={320} /></label>
        <label className="grid gap-2">Password<input name="password" className="sf-field min-h-11" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 12 : 1} maxLength={128} /></label>
        {error ? <p className="sf-alert-error" role="alert">{error}</p> : null}
        <button className="sf-btn min-h-11" disabled={pending}>{pending ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button>
      </form>
      {mode === "login" ? <p className="mt-4 text-sm"><Link href="/account/reset" className="underline underline-offset-4">Forgot your password?</Link></p> : null}
    </section>
  );
}
