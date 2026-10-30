import type { Metadata } from "next";
import { safeCallbackUrl } from "@/lib/validation/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { callbackUrl } = await props.searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-24">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-zinc-500">Client Review Portal</p>
      </div>
      <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} />
    </main>
  );
}
