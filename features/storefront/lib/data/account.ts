"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { cookies } from "next/headers";
import { removeAuthToken } from "@/features/dashboard/lib/cookies";
import { resetPassword } from "@/features/dashboard/actions/auth";

export async function customerAccountAction(_state: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  if (form.get("mode") === "register") {
    const response = await keystoneClient<{ registerCoffeeCustomer: boolean }>(
      `mutation RegisterCoffeeCustomer($name: String!, $email: String!, $password: String!) { registerCoffeeCustomer(name: $name, email: $email, password: $password) }`,
      { name: String(form.get("name") || ""), email, password }, { cache: "no-store" },
    );
    if (!response.success || !response.data.registerCoffeeCustomer) return "Account could not be created. Check your details or sign in.";
  }
  // Same sign-in as the shared dashboard action: authenticate through Keystone, then set the session cookie.
  const response = await keystoneClient<{ authenticate?: { sessionToken?: string; message?: string } | null }>(`
    mutation CustomerSignIn($email: String!, $password: String!) {
      authenticate: authenticateUserWithPassword(email: $email, password: $password) {
        ... on UserAuthenticationWithPasswordSuccess { sessionToken }
        ... on UserAuthenticationWithPasswordFailure { message }
      }
    }
  `, { email, password }, { cache: "no-store" });
  const sessionToken = response.success ? response.data.authenticate?.sessionToken : undefined;
  if (!sessionToken) return "Email or password is incorrect.";
  const cookieStore = await cookies();
  cookieStore.set("keystonejs-session", sessionToken, {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/account");
  redirect("/account");
}

export async function customerSignOut() {
  await keystoneClient(`mutation CustomerSignOut { endSession }`, {}, { cache: "no-store" });
  await removeAuthToken();
  revalidatePath("/", "layout");
  redirect("/account");
}

export type CustomerOrder = { id: string; orderNumber: string; status: string; total: number; currencyCode: string; createdAt: string };
export async function getCustomerAccount(after?: string) {
  const identity = await keystoneClient<{ authenticatedItem: { id: string; name: string; phone?: string | null } | null }>(`query CustomerIdentity { authenticatedItem { ... on User { id name phone } } }`, {}, { cache: "no-store" });
  if (!identity.success) throw new Error("Account is temporarily unavailable.");
  if (!identity.data.authenticatedItem) return null;
  const result = await keystoneClient<{ getCoffeeCustomerOrders: { orders: CustomerOrder[]; nextCursor: string | null } }>(`query CustomerOrders($after: ID) { getCoffeeCustomerOrders(after: $after) { orders { id orderNumber status total currencyCode createdAt } nextCursor } }`, { after: after || null }, { cache: "no-store" });
  if (!result.success) throw new Error("Orders could not be loaded.");
  return { user: identity.data.authenticatedItem, ...result.data.getCoffeeCustomerOrders };
}

export type ProfileState = { ok: boolean; message: string } | null;

export async function updateCustomerProfileAction(_state: ProfileState, form: FormData): Promise<ProfileState> {
  const name = String(form.get("name") || "").trim();
  const phone = String(form.get("phone") || "").trim();
  if (!name || name.length > 200) return { ok: false, message: "Enter your name (up to 200 characters)." };
  if (phone.length > 50 || !/^[+\d\s().-]*$/.test(phone)) return { ok: false, message: "Enter a phone number using digits, spaces, +, -, ( or )." };
  const response = await keystoneClient<{ updateCoffeeCustomerProfile: boolean }>(
    `mutation UpdateCoffeeCustomerProfile($name: String!, $phone: String) { updateCoffeeCustomerProfile(name: $name, phone: $phone) }`,
    { name, phone: phone || null }, { cache: "no-store" },
  );
  if (!response.success || !response.data.updateCoffeeCustomerProfile) return { ok: false, message: "Your profile couldn’t be saved. Check your details and try again." };
  revalidatePath("/account");
  return { ok: true, message: "Profile saved." };
}

export type PasswordResetState = { ok: boolean; message: string } | null;

/** Customer password reset on the storefront, using the same Keystone reset-token mutations as staff sign-in. */
export async function customerPasswordResetAction(_state: PasswordResetState, form: FormData): Promise<PasswordResetState> {
  const mode = form.get("mode") === "reset" ? "reset" : "request";
  const email = String(form.get("email") || "").trim().toLowerCase();
  if (!email || email.length > 320) return { ok: false, message: "Enter the email for your account." };
  form.set("email", email);
  if (mode === "reset") {
    const password = String(form.get("password") || "");
    if (password.length < 12 || password.length > 128) return { ok: false, message: "Choose a password between 12 and 128 characters." };
    if (password !== String(form.get("confirm") || "")) return { ok: false, message: "The two passwords don’t match." };
  }
  const result = await resetPassword({ message: null, success: null, formData: { email } }, form, mode);
  if (mode === "request") {
    // Same answer whether or not the email has an account.
    return { ok: true, message: "If an account uses that email, a reset link is on its way. Check your inbox." };
  }
  return "success" in result && result.success
    ? { ok: true, message: "Your password was reset. You can sign in now." }
    : { ok: false, message: "This reset link is invalid or has expired. Request a new one." };
}
