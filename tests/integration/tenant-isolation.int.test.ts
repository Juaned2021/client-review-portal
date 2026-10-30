// Integration test against a real Postgres loaded with the seed data
// (`npx prisma migrate deploy && npx prisma db seed`). It exercises the actual
// queries, so a missing scope in any of them makes this test fail.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { Actor } from "@/server/authz";
import { getRecentComments } from "@/server/queries/comments";
import { getDeliverableForActor } from "@/server/queries/deliverables";
import { getDeliverableStatusTotals, getProjectForActor, getProjectSummaries } from "@/server/queries/projects";

let admin: Actor;
let carla: Actor; // Acme
let acmeProjectId: string;
let globexProjectId: string;
let globexDeliverableId: string;

beforeAll(async () => {
  const users = await db.user.findMany({ select: { id: true, role: true, clientId: true, email: true } });
  const byEmail = (email: string) => {
    const u = users.find((x) => x.email === email);
    if (!u) throw new Error(`Seed user ${email} missing: run "npx prisma db seed" first`);
    return { id: u.id, role: u.role, clientId: u.clientId };
  };
  admin = byEmail("admin@agency.test");
  carla = byEmail("carla@acme.test");

  acmeProjectId = (await db.project.findFirstOrThrow({ where: { name: "Website redesign" } })).id;
  globexProjectId = (await db.project.findFirstOrThrow({ where: { name: "Product launch video" } })).id;
  globexDeliverableId = (await db.deliverable.findFirstOrThrow({ where: { title: "Storyboard" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("tenant isolation (real database)", () => {
  it("a client only lists their own company's projects", async () => {
    const projects = await getProjectSummaries(carla);
    expect(projects.length).toBeGreaterThan(0);
    expect(new Set(projects.map((p) => p.clientId))).toEqual(new Set([carla.clientId]));
  });

  it("admin lists projects across every company", async () => {
    const projects = await getProjectSummaries(admin);
    expect(new Set(projects.map((p) => p.clientName)).size).toBeGreaterThanOrEqual(2);
  });

  it("a client cannot load another company's project, even with its real id", async () => {
    expect(await getProjectForActor(carla, globexProjectId)).toBeNull();
    expect(await getProjectForActor(carla, acmeProjectId)).not.toBeNull();
  });

  it("a client cannot load another company's deliverable, even with its real id", async () => {
    expect(await getDeliverableForActor(carla, globexDeliverableId)).toBeNull();
    expect(await getDeliverableForActor(admin, globexDeliverableId)).not.toBeNull();
  });

  it("recent comments never include another company's threads", async () => {
    const comments = await getRecentComments(carla, 50);
    expect(comments.length).toBeGreaterThan(0);
    for (const c of comments) expect(c.deliverable.project.client.name).toBe("Acme Corp");
  });

  it("status totals for a client only count their own deliverables", async () => {
    const mine = await getDeliverableStatusTotals(carla);
    const all = await getDeliverableStatusTotals(admin);
    const sum = (t: Record<string, number>) => Object.values(t).reduce((a, b) => a + b, 0);
    const acmeCount = await db.deliverable.count({ where: { project: { clientId: carla.clientId! } } });
    expect(sum(mine)).toBe(acmeCount);
    expect(sum(all)).toBeGreaterThan(sum(mine));
  });

  it("dashboard aggregates match the raw rows (one-query JOIN + COUNT FILTER)", async () => {
    const [summary] = (await getProjectSummaries(admin, { q: "Website redesign" })).filter((p) => p.id === acmeProjectId);
    const rows = await db.deliverable.groupBy({ by: ["status"], where: { projectId: acmeProjectId }, _count: { _all: true } });
    const count = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
    expect(summary).toMatchObject({
      pending: count("PENDING_REVIEW"),
      changesRequested: count("CHANGES_REQUESTED"),
      approved: count("APPROVED"),
      dueDate: "2026-12-15",
    });
  });

  it("search escapes LIKE wildcards", async () => {
    expect(await getProjectSummaries(admin, { q: "%" })).toEqual([]);
    expect(await getProjectSummaries(admin, { q: "_" })).toEqual([]);
  });
});
