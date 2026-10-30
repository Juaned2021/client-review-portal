"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { logActivity } from "@/server/activity";
import { canManageProjects } from "@/server/authz";
import { getCurrentUser } from "@/server/session";
import { createProjectSchema } from "@/lib/validation/project";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> } | undefined;

export async function createProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  // Server Actions are public POST endpoints: authorize inside, never rely on the page.
  const user = await getCurrentUser();
  if (!user || !canManageProjects(user)) return { error: "You are not allowed to create projects." };

  const parsed = createProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const client = await db.client.findUnique({ where: { id: parsed.data.clientId }, select: { id: true } });
  if (!client) return { fieldErrors: { clientId: ["Unknown client"] } };

  const project = await db.$transaction(async (tx) => {
    const created = await tx.project.create({ data: parsed.data, select: { id: true } });
    await logActivity(tx, { action: "PROJECT_CREATED", clientId: client.id, actorId: user.id, projectId: created.id });
    return created;
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}
