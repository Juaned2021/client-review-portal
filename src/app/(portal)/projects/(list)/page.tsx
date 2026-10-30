import type { Metadata } from "next";
import Link from "next/link";
import { ProjectTable } from "@/components/project-table";
import { statusLabel } from "@/components/status-badge";
import { canManageProjects, isAdmin } from "@/server/authz";
import { getProjectSummaries } from "@/server/queries/projects";
import { requireUser } from "@/server/session";
import { PROJECT_STATUSES, firstParam, projectFiltersSchema } from "@/lib/validation/project";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const user = await requireUser();
  const params = await props.searchParams;
  // Filters live in the URL, so they are shareable, bookmarkable and server-rendered.
  const filters = projectFiltersSchema.parse({
    status: firstParam(params.status),
    q: firstParam(params.q) || undefined,
  });
  const projects = await getProjectSummaries(user, filters);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Projects</h1>
        {canManageProjects(user) && (
          <Link href="/projects/new" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
            New project
          </Link>
        )}
      </div>

      {/* A plain GET form: submitting updates ?status=&q= and the server re-renders. No client JS needed. */}
      <form method="get" className="flex flex-wrap items-end gap-3" role="search">
        <label className="flex flex-col gap-1 text-sm">
          Search
          <input
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Project name…"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
          Apply
        </button>
        {(filters.q || filters.status) && (
          <Link href="/projects" className="px-2 py-2 text-sm text-zinc-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <ProjectTable projects={projects} showClient={isAdmin(user)} />
    </div>
  );
}
