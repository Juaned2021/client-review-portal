import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { DeliverableStatus, ProjectStatus } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { clientIdFilter, deliverableScope, projectScope, type Actor } from "@/server/authz";
import { toDateOnlyString } from "@/lib/dates";
import type { ProjectFilters } from "@/lib/validation/project";

export type ProjectSummary = {
  id: string;
  name: string;
  status: ProjectStatus;
  dueDate: string | null; // "YYYY-MM-DD"
  clientId: string;
  clientName: string;
  pending: number;
  changesRequested: number;
  approved: number;
  total: number;
  lastActivityAt: string | null; // ISO UTC
};

/** Escape LIKE wildcards so a search for "50%" matches literally. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * One round trip: projects joined with their client, plus deliverable counts per
 * status via `COUNT(*) FILTER (WHERE ...)`. Values are bound as parameters by
 * the tagged template, never concatenated into the SQL string.
 */
export async function getProjectSummaries(actor: Actor, filters: ProjectFilters = {}): Promise<ProjectSummary[]> {
  const clientId = clientIdFilter(actor);
  const conditions: Prisma.Sql[] = [];
  if (clientId) conditions.push(Prisma.sql`p."clientId" = ${clientId}`);
  if (filters.status) conditions.push(Prisma.sql`p."status" = ${filters.status}::"ProjectStatus"`);
  if (filters.q) conditions.push(Prisma.sql`p."name" ILIKE ${likePattern(filters.q)}`);
  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

  const rows = await db.$queryRaw<
    Array<Omit<ProjectSummary, "lastActivityAt"> & { lastActivityAt: Date | null }>
  >`
    SELECT
      p."id",
      p."name",
      p."status",
      to_char(p."dueDate", 'YYYY-MM-DD') AS "dueDate",
      c."id"   AS "clientId",
      c."name" AS "clientName",
      COUNT(d."id") FILTER (WHERE d."status" = 'PENDING_REVIEW')::int    AS "pending",
      COUNT(d."id") FILTER (WHERE d."status" = 'CHANGES_REQUESTED')::int AS "changesRequested",
      COUNT(d."id") FILTER (WHERE d."status" = 'APPROVED')::int          AS "approved",
      COUNT(d."id")::int AS "total",
      MAX(d."createdAt") AS "lastActivityAt"
    FROM "Project" p
    JOIN "Client" c ON c."id" = p."clientId"
    LEFT JOIN "Deliverable" d ON d."projectId" = p."id"
    ${where}
    GROUP BY p."id", c."id"
    ORDER BY p."dueDate" ASC NULLS LAST, p."name" ASC
  `;

  return rows.map((r) => ({ ...r, lastActivityAt: r.lastActivityAt?.toISOString() ?? null }));
}

/** Deliverable totals by status across everything the actor can see. */
export async function getDeliverableStatusTotals(actor: Actor): Promise<Record<DeliverableStatus, number>> {
  const groups = await db.deliverable.groupBy({
    by: ["status"],
    where: deliverableScope(actor),
    _count: { _all: true },
  });
  const totals: Record<DeliverableStatus, number> = { PENDING_REVIEW: 0, CHANGES_REQUESTED: 0, APPROVED: 0 };
  for (const g of groups) totals[g.status] = g._count._all;
  return totals;
}

/**
 * Loads a project only if it is inside the actor's scope. Returning `null` for
 * "exists but belongs to another company" means callers respond 404, not 403,
 * so IDs from other tenants cannot even be confirmed to exist.
 */
export async function getProjectForActor(actor: Actor, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, ...projectScope(actor) },
    select: {
      id: true,
      name: true,
      status: true,
      dueDate: true,
      createdAt: true,
      client: { select: { id: true, name: true } },
      // Loaded with the project (no N+1): comment counts come from one aggregate.
      deliverables: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          version: true,
          createdAt: true,
          _count: { select: { comments: true } },
        },
      },
    },
  });
  if (!project) return null;

  return {
    ...project,
    dueDate: project.dueDate ? toDateOnlyString(project.dueDate) : null,
    createdAt: project.createdAt.toISOString(),
    deliverables: project.deliverables.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
  };
}

export async function listClientsForAdmin() {
  return db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}
