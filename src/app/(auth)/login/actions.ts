"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { loginSchema, safeCallbackUrl } from "@/lib/validation/auth";

export type LoginState = { error?: string; email?: string } | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
  } catch (error) {
    // signIn throws a redirect on success; only swallow genuine auth failures.
    if (error instanceof AuthError) {
      // Same message for "no such user" and "wrong password": don't leak which one.
      return { error: "Invalid email or password", email: parsed.data.email };
    }
    throw error;
  }
}
