import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email" })),
  password: z.string().min(1, { error: "Password is required" }).max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Only allow same-origin relative paths as post-login redirects (prevents open redirects). */
export function safeCallbackUrl(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
