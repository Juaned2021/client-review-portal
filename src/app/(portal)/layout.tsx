import Link from "next/link";
import { signOut } from "@/auth";
import { requireUser } from "@/server/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="font-semibold">
              Client Review Portal
            </Link>
            <Link href="/projects" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">
              Projects
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {user.name}
              <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium dark:bg-zinc-800">
                {user.role === "ADMIN" ? "Admin" : "Client"}
              </span>
            </span>
            {/* A plain form + Server Action: logout works even without client JS. */}
            <form action={signOutAction}>
              <button type="submit" className="text-zinc-600 underline-offset-4 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
