import "server-only";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@/server/db";
import { logActivity } from "@/server/activity";
import { canComment, deliverableScope, type Actor } from "@/server/authz";
import { commentSelect, toCommentDTO } from "@/server/queries/comments";
import { commentBodySchema } from "@/lib/validation/deliverable";
import { protectedProcedure, router } from "../init";

const deliverableIdInput = z.object({ deliverableId: z.string().trim().min(1).max(64) });

/** Tenant-scoped lookup; another company's deliverable is indistinguishable from a missing one. */
async function findDeliverableOrThrow(actor: Actor, deliverableId: string) {
  const deliverable = await db.deliverable.findFirst({
    where: { id: deliverableId, ...deliverableScope(actor) },
    select: { id: true, projectId: true, project: { select: { clientId: true } } },
  });
  if (!deliverable) throw new TRPCError({ code: "NOT_FOUND", message: "Deliverable not found" });
  return deliverable;
}

export const commentRouter = router({
  list: protectedProcedure.input(deliverableIdInput).query(async ({ ctx, input }) => {
    await findDeliverableOrThrow(ctx.user, input.deliverableId);
    const comments = await db.comment.findMany({
      where: { deliverableId: input.deliverableId },
      orderBy: { createdAt: "asc" },
      select: commentSelect,
    });
    return comments.map(toCommentDTO);
  }),

  add: protectedProcedure
    .input(deliverableIdInput.extend({ body: commentBodySchema }))
    .mutation(async ({ ctx, input }) => {
      const deliverable = await findDeliverableOrThrow(ctx.user, input.deliverableId);
      if (!canComment(ctx.user, deliverable.project.clientId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot comment on this deliverable" });
      }

      const comment = await db.$transaction(async (tx) => {
        const created = await tx.comment.create({
          data: { deliverableId: deliverable.id, authorId: ctx.user.id, body: input.body },
          select: commentSelect,
        });
        // The audit log records that a comment happened, never its text.
        await logActivity(tx, {
          action: "COMMENT_ADDED",
          clientId: deliverable.project.clientId,
          actorId: ctx.user.id,
          projectId: deliverable.projectId,
          deliverableId: deliverable.id,
        });
        return created;
      });
      return toCommentDTO(comment);
    }),
});
