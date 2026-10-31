import "server-only";
import { db } from "@/server/db";
import { deliverableScope, type Actor } from "@/server/authz";
import { commentSelect, toCommentDTO } from "@/server/queries/comments";

/**
 * Everything the deliverable page needs in one call: details, project/client,
 * comment thread and status history (nested selects, so no N+1 queries).
 * Returns null when the deliverable is outside the actor's tenant.
 */
export async function getDeliverableForActor(actor: Actor, deliverableId: string) {
  const d = await db.deliverable.findFirst({
    where: { id: deliverableId, ...deliverableScope(actor) },
    select: {
      id: true,
      title: true,
      status: true,
      version: true,
      linkUrl: true,
      fileUrl: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { id: true, name: true, clientId: true, client: { select: { name: true } } } },
      comments: { orderBy: { createdAt: "asc" }, select: commentSelect },
      // Status history only: comments are logged too, but they are not status changes.
      activities: {
        where: { action: { not: "COMMENT_ADDED" } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          fromStatus: true,
          toStatus: true,
          version: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      },
    },
  });
  if (!d) return null;

  return {
    ...d,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    comments: d.comments.map(toCommentDTO),
    activities: d.activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };
}

export type DeliverableDetail = NonNullable<Awaited<ReturnType<typeof getDeliverableForActor>>>;
