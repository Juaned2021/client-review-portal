// Calls the real tRPC procedures (no HTTP) as different users against the seeded DB.
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import type { SessionUser } from "@/server/session";
import { appRouter } from "@/server/trpc/root";

let carla: SessionUser; // Acme client
let admin: SessionUser;
let acmeDeliverableId: string;
let globexDeliverableId: string;
const createdIds: string[] = [];

const callerFor = (user: SessionUser | null) => appRouter.createCaller({ user });

beforeAll(async () => {
  const pick = { id: true, name: true, role: true, clientId: true } as const;
  carla = await db.user.findUniqueOrThrow({ where: { email: "carla@acme.test" }, select: pick });
  admin = await db.user.findUniqueOrThrow({ where: { email: "admin@agency.test" }, select: pick });
  acmeDeliverableId = (await db.deliverable.findFirstOrThrow({ where: { title: "Visual design: homepage" } })).id;
  globexDeliverableId = (await db.deliverable.findFirstOrThrow({ where: { title: "Storyboard" } })).id;
});

afterAll(async () => {
  await db.activityLog.deleteMany({ where: { action: "COMMENT_ADDED", actorId: { in: [carla.id, admin.id] }, createdAt: { gte: new Date(Date.now() - 60_000) } } });
  await db.comment.deleteMany({ where: { id: { in: createdIds } } });
  await db.$disconnect();
});

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof TRPCError ? e.code : "UNKNOWN";
  }
};

describe("comment tRPC router (real database)", () => {
  it("rejects anonymous callers", async () => {
    expect(await codeOf(callerFor(null).comment.list({ deliverableId: acmeDeliverableId }))).toBe("UNAUTHORIZED");
  });

  it("lists comments of the caller's own deliverable", async () => {
    const comments = await callerFor(carla).comment.list({ deliverableId: acmeDeliverableId });
    expect(comments.length).toBeGreaterThan(0);
    expect(typeof comments[0]!.createdAt).toBe("string"); // ISO UTC string, formatted on the client
  });

  it("hides another company's thread as NOT_FOUND (read and write)", async () => {
    expect(await codeOf(callerFor(carla).comment.list({ deliverableId: globexDeliverableId }))).toBe("NOT_FOUND");
    expect(await codeOf(callerFor(carla).comment.add({ deliverableId: globexDeliverableId, body: "sneaky" }))).toBe("NOT_FOUND");
    expect(await db.comment.count({ where: { body: "sneaky" } })).toBe(0);
  });

  it("validates the body with Zod", async () => {
    expect(await codeOf(callerFor(carla).comment.add({ deliverableId: acmeDeliverableId, body: "   " }))).toBe("BAD_REQUEST");
  });

  it("adds a comment and logs the event without its text", async () => {
    const body = `Integration comment ${Date.now()}`;
    const comment = await callerFor(carla).comment.add({ deliverableId: acmeDeliverableId, body });
    createdIds.push(comment.id);
    expect(comment).toMatchObject({ body, author: { id: carla.id, name: carla.name } });

    const log = await db.activityLog.findFirst({
      where: { action: "COMMENT_ADDED", actorId: carla.id, deliverableId: acmeDeliverableId },
      orderBy: { createdAt: "desc" },
    });
    expect(log).not.toBeNull();
    expect(JSON.stringify(log)).not.toContain(body);
  });

  it("lets the agency comment on any client's deliverable", async () => {
    const comment = await callerFor(admin).comment.add({ deliverableId: globexDeliverableId, body: "Agency note" });
    createdIds.push(comment.id);
    expect(comment.author.role).toBe("ADMIN");
  });
});
