import "server-only";
import { db } from "@/server/db";
import { commentScope, type Actor } from "@/server/authz";

/** Latest comments across every project the actor can see, in one query (no N+1). */
export async function getRecentComments(actor: Actor, take = 8) {
  const comments = await db.comment.findMany({
    where: commentScope(actor),
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { name: true, role: true } },
      deliverable: {
        select: {
          id: true,
          title: true,
          project: { select: { name: true, client: { select: { name: true } } } },
        },
      },
    },
  });
  return comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }));
}
