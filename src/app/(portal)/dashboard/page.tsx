import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { ProjectTable } from "@/components/project-table";
import { statusLabel } from "@/components/status-badge";
import { isAdmin } from "@/server/authz";
import { getRecentComments } from "@/server/queries/comments";
import { getDeliverableStatusTotals, getProjectSummaries } from "@/server/queries/projects";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const admin = isAdmin(user);

  // Independent queries run in parallel; each one is scoped to the user.
  const [projects, totals, comments] = await Promise.all([
    getProjectSummaries(user, { status: "ACTIVE" }),
    getDeliverableStatusTotals(user),
    getRecentComments(user, 6),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
          <p className="text-zinc-500">{admin ? "All client work at a glance." : "Your company's projects and reviews."}</p>
        </div>
        {admin && (
          <Link href="/projects/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
            New project
          </Link>
        )}
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(Object.keys(totals) as Array<keyof typeof totals>).map((status) => (
          <div key={status} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">{statusLabel(status)}</p>
            <p className="text-3xl font-semibold tabular-nums">{totals[status]}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active projects</h2>
          <Link href="/projects" className="text-sm text-zinc-600 hover:underline">
            View all
          </Link>
        </div>
        <ProjectTable projects={projects} showClient={admin} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent comments</h2>
        {comments.length === 0 ? (
          <p className="text-sm text-zinc-500">No comments yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {comments.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 text-zinc-500">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{c.author.name}</span>
                  <span>on</span>
                  <Link href={`/deliverables/${c.deliverable.id}`} className="hover:underline">
                    {c.deliverable.title}
                  </Link>
                  {admin && <span>· {c.deliverable.project.client.name}</span>}
                  <span>·</span>
                  <LocalTime iso={c.createdAt} />
                </div>
                <p className="line-clamp-2">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
