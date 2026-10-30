import type { DeliverableStatus, ProjectStatus } from "@/generated/prisma/enums";

const STYLES: Record<DeliverableStatus | ProjectStatus, { label: string; className: string }> = {
  PENDING_REVIEW: { label: "Pending review", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  CHANGES_REQUESTED: { label: "Changes requested", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  ACTIVE: { label: "Active", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  ON_HOLD: { label: "On hold", className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  COMPLETED: { label: "Completed", className: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" },
};

export function StatusBadge({ status }: { status: DeliverableStatus | ProjectStatus }) {
  const { label, className } = STYLES[status];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}

export function statusLabel(status: DeliverableStatus | ProjectStatus) {
  return STYLES[status].label;
}
