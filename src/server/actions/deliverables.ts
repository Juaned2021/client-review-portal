"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { logActivity } from "@/server/activity";
import { canManageProjects, deliverableScope } from "@/server/authz";
import { decideNewVersion, decideReview } from "@/server/review";
import { getCurrentUser } from "@/server/session";
import { createDeliverableSchema, newVersionSchema, reviewSchema } from "@/lib/validation/deliverable";
import type { FormState } from "@/server/actions/projects";

const CONFLICT = "This deliverable was updated by someone else. Refresh and try again.";

function revalidateDeliverable(deliverableId: string, projectId: string) {
  revalidatePath(`/deliverables/${deliverableId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function createDeliverableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || !canManageProjects(user)) return { error: "You are not allowed to add deliverables." };

  const parsed = createDeliverableSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { projectId, title, linkUrl } = parsed.data;

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true } });
  if (!project) return { error: "Project not found." };

  const deliverable = await db.$transaction(async (tx) => {
    const created = await tx.deliverable.create({ data: { projectId, title, linkUrl }, select: { id: true } });
    await logActivity(tx, {
      action: "DELIVERABLE_CREATED",
      clientId: project.clientId,
      actorId: user.id,
      projectId,
      deliverableId: created.id,
      toStatus: "PENDING_REVIEW",
      version: 1,
    });
    return created;
  });

  revalidateDeliverable(deliverable.id, projectId);
  redirect(`/deliverables/${deliverable.id}`);
}

export async function reviewDeliverableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };

  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid review." };
  const { deliverableId, decision, comment } = parsed.data;

  // Scoped lookup: another company's deliverable is simply "not found".
  const deliverable = await db.deliverable.findFirst({
    where: { id: deliverableId, ...deliverableScope(user) },
    select: { id: true, status: true, version: true, projectId: true, project: { select: { clientId: true } } },
  });
  if (!deliverable) return { error: "Deliverable not found." };

  const result = decideReview({
    actor: user,
    projectClientId: deliverable.project.clientId,
    currentStatus: deliverable.status,
    decision,
    comment,
  });
  if (!result.ok) return { error: result.message, fieldErrors: result.code === "COMMENT_REQUIRED" ? { comment: [result.message] } : undefined };

  const updated = await db.$transaction(async (tx) => {
    // Optimistic concurrency: only succeeds if nobody changed the status meanwhile.
    const { count } = await tx.deliverable.updateMany({
      where: { id: deliverable.id, status: deliverable.status, version: deliverable.version },
      data: { status: result.toStatus },
    });
    if (count === 0) return false;

    if (comment) {
      await tx.comment.create({ data: { deliverableId: deliverable.id, authorId: user.id, body: comment } });
    }
    await logActivity(tx, {
      action: result.action,
      clientId: deliverable.project.clientId,
      actorId: user.id,
      projectId: deliverable.projectId,
      deliverableId: deliverable.id,
      fromStatus: deliverable.status,
      toStatus: result.toStatus,
      version: deliverable.version,
    });
    return true;
  });
  if (!updated) return { error: CONFLICT };

  revalidateDeliverable(deliverable.id, deliverable.projectId);
  return undefined;
}

export async function submitNewVersionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };

  const parsed = newVersionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { deliverableId, linkUrl } = parsed.data;

  const deliverable = await db.deliverable.findFirst({
    where: { id: deliverableId, ...deliverableScope(user) },
    select: { id: true, status: true, version: true, projectId: true, project: { select: { clientId: true } } },
  });
  if (!deliverable) return { error: "Deliverable not found." };

  const result = decideNewVersion({ actor: user, currentStatus: deliverable.status });
  if (!result.ok) return { error: result.message };

  const nextVersion = deliverable.version + 1;
  const updated = await db.$transaction(async (tx) => {
    const { count } = await tx.deliverable.updateMany({
      where: { id: deliverable.id, status: deliverable.status, version: deliverable.version },
      data: { status: result.toStatus, version: nextVersion, linkUrl },
    });
    if (count === 0) return false;
    await logActivity(tx, {
      action: result.action,
      clientId: deliverable.project.clientId,
      actorId: user.id,
      projectId: deliverable.projectId,
      deliverableId: deliverable.id,
      fromStatus: deliverable.status,
      toStatus: result.toStatus,
      version: nextVersion,
    });
    return true;
  });
  if (!updated) return { error: CONFLICT };

  revalidateDeliverable(deliverable.id, deliverable.projectId);
  return undefined;
}
