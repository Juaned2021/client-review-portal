import { PageSkeleton } from "@/components/page-skeleton";

// Streams a skeleton while the dashboard queries run. Loading UI is only used on
// list pages: once streaming starts the HTTP status is fixed at 200, and detail
// pages must be able to answer a real 404 for other tenants' IDs.
export default function Loading() {
  return <PageSkeleton />;
}
