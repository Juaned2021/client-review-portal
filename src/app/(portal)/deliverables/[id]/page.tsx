import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentThread } from "@/components/comment-thread";
import { LocalTime } from "@/components/local-time";
import { StatusBadge } from "@/components/status-badge";
import type { ActivityAction } from "@/generated/prisma/enums";
import { canComment, canReviewDeliverable, isAdmin } from "@/server/authz";
import { getDeliverableForActor } from "@/server/queries/deliverables";
import { requireUser } from "@/server/session";
import { NewVersionForm } from "./new-version-form";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Deliverable" };

const ACTION_LABELS: Record<ActivityAction, string> = {
  PROJECT_CREATED: "created the project",
  DELIVERABLE_CREATED: "uploaded the deliverable",
  VERSION_SUBMITTED: "submitted a new version",
  DELIVERABLE_APPROVED: "approved",
  CHANGES_REQUESTED: "requested changes",
  COMMENT_ADDED: "commented",
};

export default async function DeliverablePage(props: PageProps<"/deliverables/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const d = await getDeliverableForActor(user, id);
  if (!d) notFound();

  const canReview = canReviewDeliverable(user, d.project.clientId) && d.status === "PENDING_REVIEW";
  const canSubmitVersion = isAdmin(user) && d.status === "CHANGES_REQUESTED";
  const href = d.fileUrl ?? d.linkUrl;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <div>
          <Link href={`/projects/${d.project.id}`} className="text-sm text-zinc-500 hover:underline">
            ← {d.project.name}
            {isAdmin(user) && ` · ${d.project.client.name}`}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{d.title}</h1>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium dark:bg-zinc-800">v{d.version}</span>
            <StatusBadge status={d.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Uploaded <LocalTime iso={d.createdAt} /> · last updated <LocalTime iso={d.updatedAt} />
          </p>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:underline dark:text-sky-400"
            >
              Open deliverable ↗
            </a>
          )}
        </div>

        {canReview && <ReviewForm deliverableId={d.id} />}
        {canSubmitVersion && <NewVersionForm deliverableId={d.id} nextVersion={d.version + 1} />}

        <CommentThread
          deliverableId={d.id}
          viewer={{ id: user.id, name: user.name, role: user.role }}
          initialComments={d.comments}
          canComment={canComment(user, d.project.clientId)}
        />
      </div>

      <aside className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Status history</h2>
        {d.activities.length === 0 ? (
          <p className="text-sm text-zinc-500">No activity recorded yet.</p>
        ) : (
          <ol className="flex flex-col gap-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
            {d.activities.map((a) => (
              <li key={a.id} className="text-sm">
                <p>
                  <span className="font-medium">{a.actor?.name ?? "Deleted user"}</span> {ACTION_LABELS[a.action]}
                  {a.version != null && <span className="text-zinc-500"> (v{a.version})</span>}
                </p>
                {a.toStatus && (
                  <div className="mt-1">
                    <StatusBadge status={a.toStatus} />
                  </div>
                )}
                <LocalTime iso={a.createdAt} className="text-xs text-zinc-500" />
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
