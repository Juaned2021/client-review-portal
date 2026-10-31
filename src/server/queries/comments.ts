import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { commentScope, type Actor } from "@/server/authz";

/** One shape for a comment everywhere (server page, tRPC, optimistic cache). */
export const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} satisfies Prisma.CommentSelect;

type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;
export type CommentDTO = Omit<CommentRow, "createdAt"> & { createdAt: string };

export const toCommentDTO = (c: CommentRow): CommentDTO => ({ ...c, createdAt: c.createdAt.toISOString() });

/** Latest comments across every project the actor can see, in one query (no N+1). */
export async function getRecentComments(actor: Actor, take = 8) {
  const comments = await db.comment.findMany({
    where: commentScope(actor),
    orderBy: { createdAt: "desc" },
    take,
    select: {
      ...commentSelect,
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
