"use client";
// Client Component: error boundaries must be client components (they catch
// rendering errors and offer a retry that re-renders the segment).

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/40">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      {/* In production Next.js hides server error messages; the digest correlates with server logs. */}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Please try again. {error.digest && <span className="font-mono text-xs">Ref: {error.digest}</span>}
      </p>
      <button onClick={reset} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
        Try again
      </button>
    </div>
  );
}
