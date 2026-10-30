export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-4 w-80 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 h-64 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}
