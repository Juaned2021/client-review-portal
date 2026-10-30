import Link from "next/link";
import { formatDateOnly } from "@/lib/dates";
import type { ProjectSummary } from "@/server/queries/projects";
import { StatusBadge } from "./status-badge";

export function ProjectTable({ projects, showClient }: { projects: ProjectSummary[]; showClient: boolean }) {
  if (projects.length === 0) {
    return <p className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-zinc-500">No projects found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-2">Project</th>
            {showClient && <th className="px-4 py-2">Client</th>}
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Due</th>
            <th className="px-4 py-2 text-right">Pending</th>
            <th className="px-4 py-2 text-right">Changes</th>
            <th className="px-4 py-2 text-right">Approved</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {projects.map((p) => (
            <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
              <td className="px-4 py-2 font-medium">
                <Link href={`/projects/${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
              </td>
              {showClient && <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{p.clientName}</td>}
              <td className="px-4 py-2">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{p.dueDate ? formatDateOnly(p.dueDate) : "—"}</td>
              <td className="px-4 py-2 text-right tabular-nums">{p.pending}</td>
              <td className="px-4 py-2 text-right tabular-nums">{p.changesRequested}</td>
              <td className="px-4 py-2 text-right tabular-nums">{p.approved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
