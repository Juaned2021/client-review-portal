// Single source of truth for "who can see / do what".
//
// Two kinds of helpers live here:
// 1. Scope builders return Prisma `where` fragments. Every read query composes
//    one of them, so a client can only ever *find* rows of their own company:
//    guessing another company's ID simply returns nothing (-> 404).
// 2. Predicates/assertions answer yes/no for mutations on an already-loaded row.
//
// Everything is pure (no DB access), which keeps it trivially unit-testable.

import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/server/session";

export type Actor = Pick<SessionUser, "id" | "role" | "clientId">;

export class AuthorizationError extends Error {
  constructor(message = "Not allowed") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export const isAdmin = (actor: Actor) => actor.role === "ADMIN";

/** The company a client user belongs to. Throws if the data is inconsistent. */
function tenantOf(actor: Actor): string {
  if (!actor.clientId) throw new AuthorizationError("Client user without a company");
  return actor.clientId;
}

// ---------------------------------------------------------------------------
// Scope builders (reads)
// ---------------------------------------------------------------------------

export function projectScope(actor: Actor): Prisma.ProjectWhereInput {
  return isAdmin(actor) ? {} : { clientId: tenantOf(actor) };
}

export function deliverableScope(actor: Actor): Prisma.DeliverableWhereInput {
  return isAdmin(actor) ? {} : { project: { clientId: tenantOf(actor) } };
}

export function commentScope(actor: Actor): Prisma.CommentWhereInput {
  return isAdmin(actor) ? {} : { deliverable: { project: { clientId: tenantOf(actor) } } };
}

/** `null` means "all companies" (admin); used by raw SQL queries. */
export function clientIdFilter(actor: Actor): string | null {
  return isAdmin(actor) ? null : tenantOf(actor);
}

// ---------------------------------------------------------------------------
// Predicates (mutations on a loaded row)
// ---------------------------------------------------------------------------

/** Admins see everything; client users only their own company's data. */
export function canAccessClient(actor: Actor, clientId: string): boolean {
  return isAdmin(actor) || actor.clientId === clientId;
}

/** Only the project's own client can approve or request changes, never the agency. */
export function canReviewDeliverable(actor: Actor, projectClientId: string): boolean {
  return actor.role === "CLIENT" && actor.clientId === projectClientId;
}

/** Agency admins and the project's own client can take part in the thread. */
export function canComment(actor: Actor, projectClientId: string): boolean {
  return canAccessClient(actor, projectClientId);
}

export function canManageProjects(actor: Actor): boolean {
  return isAdmin(actor);
}

export function assertAdmin(actor: Actor): void {
  if (!isAdmin(actor)) throw new AuthorizationError("Admin only");
}
