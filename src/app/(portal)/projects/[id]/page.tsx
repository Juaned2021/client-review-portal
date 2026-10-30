import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/status-badge";
import { formatDateOnly } from "@/lib/dates";
import { canManageProjects, isAdmin } from "@/server/authz";
import { getProjectForActor } from "@/server/queries/projects";
import { requireUser } from "@/server/session";
import { DeliverableForm } from "./deliverable-form";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const project = await getProjectForActor(user, id);
  // Same response whether the project doesn't exist or belongs to another company.
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/projects" className="text-sm text-zinc-500 hover:underline">
          ← Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {isAdmin(user) && <>{project.client.name} · </>}
          Due {project.dueDate ? formatDateOnly(project.dueDate) : "—"}
        </p>
      </div>

      {canManageProjects(user) && <DeliverableForm projectId={project.id} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Deliverables</h2>
        {project.deliverables.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-zinc-500">No deliverables yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {project.deliverables.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex flex-col">
                  <Link href={`/deliverables/${d.id}`} className="font-medium hover:underline">
                    {d.title} <span className="text-xs font-normal text-zinc-500">v{d.version}</span>
                  </Link>
                  <span className="text-xs text-zinc-500">
                    <LocalTime iso={d.createdAt} /> · {d._count.comments} comment{d._count.comments === 1 ? "" : "s"}
                  </span>
                </div>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
