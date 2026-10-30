import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Client Review Portal</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Agencies upload deliverables, clients review them, approve or request changes, and
        discuss everything in one place.
      </p>
      <div>
        <Link
          href="/login"
          className="inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
