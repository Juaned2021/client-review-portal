import Link from "next/link";

// Also used when a resource belongs to another company: we never confirm it exists.
export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h2 className="text-lg font-semibold">Not found</h2>
      <p className="text-sm text-zinc-500">This page doesn&apos;t exist or you don&apos;t have access to it.</p>
      <Link href="/dashboard" className="text-sm underline">
        Back to dashboard
      </Link>
    </div>
  );
}
