import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db";
import type { Role } from "@/generated/prisma/enums";

/** The minimal, non-sensitive view of the signed-in user used for authorization. */
export type SessionUser = {
  id: string;
  name: string;
  role: Role;
  clientId: string | null;
};

/**
 * Reads the session and loads the user's current role/company from the database.
 * `cache` dedupes this to one query per request, no matter how many components call it.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  return db.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, clientId: true },
  });
});

/** For pages and Server Actions: redirect to /login if not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Admin-only pages respond 404 to clients so the route's existence is not revealed. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  return user;
}
