import { PageSkeleton } from "@/components/page-skeleton";

// The (list) route group scopes this loading UI to /projects only, so
// /projects/[id] does not stream and can still respond with a real 404.
export default function Loading() {
  return <PageSkeleton />;
}
