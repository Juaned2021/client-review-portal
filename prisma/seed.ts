import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

// Demo-only password, documented in the README. Override with SEED_DEMO_PASSWORD.
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Demo1234!";

/** Date-only values are created at UTC midnight so Postgres stores the exact calendar day. */
const day = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error("Refusing to seed a production database (set SEED_ALLOW_PRODUCTION=true).");
  }

  // Wipe in FK order so the seed is repeatable.
  await db.activityLog.deleteMany();
  await db.comment.deleteMany();
  await db.deliverable.deleteMany();
  await db.project.deleteMany();
  await db.user.deleteMany();
  await db.client.deleteMany();

  const passwordHash = await hash(DEMO_PASSWORD, 12);

  const admin = await db.user.create({
    data: { name: "Ana Admin", email: "admin@agency.test", passwordHash, role: "ADMIN" },
  });

  const acme = await db.client.create({
    data: {
      name: "Acme Corp",
      users: { create: { name: "Carla Acme", email: "carla@acme.test", passwordHash } },
    },
    include: { users: true },
  });
  const globex = await db.client.create({
    data: {
      name: "Globex",
      users: { create: { name: "Gabriel Globex", email: "gabriel@globex.test", passwordHash } },
    },
    include: { users: true },
  });
  const carla = acme.users[0]!;
  const gabriel = globex.users[0]!;

  await db.project.create({
    data: {
      name: "Website redesign",
      clientId: acme.id,
      dueDate: day("2026-12-15"),
      deliverables: {
        create: [
          {
            title: "Homepage wireframes",
            linkUrl: "https://www.figma.com/file/demo-homepage-v2",
            status: "APPROVED",
            version: 2,
            createdAt: hoursAgo(120),
            comments: {
              create: [
                { body: "First pass of the homepage layout is ready.", authorId: admin.id, createdAt: hoursAgo(119) },
                { body: "Please move the pricing section above the testimonials.", authorId: carla.id, createdAt: hoursAgo(110) },
                { body: "Looks great, approved!", authorId: carla.id, createdAt: hoursAgo(96) },
              ],
            },
          },
          {
            title: "Visual design: homepage",
            linkUrl: "https://www.figma.com/file/demo-visual",
            status: "CHANGES_REQUESTED",
            createdAt: hoursAgo(48),
            comments: {
              create: [
                { body: "Hero image feels too dark. Can we try a lighter variant?", authorId: carla.id, createdAt: hoursAgo(30) },
              ],
            },
          },
          {
            title: "About page copy",
            linkUrl: "https://docs.google.com/document/d/demo-about",
            status: "PENDING_REVIEW",
            createdAt: hoursAgo(5),
          },
        ],
      },
    },
  });

  await db.project.create({
    data: {
      name: "Brand guidelines",
      clientId: acme.id,
      status: "COMPLETED",
      dueDate: day("2026-09-30"),
      deliverables: {
        create: { title: "Brand book PDF", linkUrl: "https://example.com/brand-book.pdf", status: "APPROVED", createdAt: hoursAgo(900) },
      },
    },
  });

  await db.project.create({
    data: {
      name: "Product launch video",
      clientId: globex.id,
      dueDate: day("2026-11-20"),
      deliverables: {
        create: [
          {
            title: "Storyboard",
            linkUrl: "https://example.com/storyboard",
            status: "PENDING_REVIEW",
            createdAt: hoursAgo(20),
            comments: {
              create: [
                { body: "Storyboard uploaded, feedback welcome.", authorId: admin.id, createdAt: hoursAgo(19) },
                { body: "Reviewing with the team today.", authorId: gabriel.id, createdAt: hoursAgo(3) },
              ],
            },
          },
        ],
      },
    },
  });

  await db.project.create({
    data: { name: "Q1 social campaign", clientId: globex.id, status: "ON_HOLD", dueDate: day("2027-01-31") },
  });

  // Status history consistent with each deliverable's current state.
  const reviewerFor: Record<string, string> = { [acme.id]: carla.id, [globex.id]: gabriel.id };
  const all = await db.deliverable.findMany({
    select: { id: true, status: true, version: true, createdAt: true, projectId: true, project: { select: { clientId: true } } },
  });
  for (const d of all) {
    const base = { clientId: d.project.clientId, projectId: d.projectId, deliverableId: d.id };
    const at = (h: number) => new Date(d.createdAt.getTime() + h * 60 * 60 * 1000);
    const reviewer = reviewerFor[d.project.clientId]!;
    const entries: Prisma.ActivityLogCreateManyInput[] = [
      { ...base, action: "DELIVERABLE_CREATED", actorId: admin.id, toStatus: "PENDING_REVIEW", version: 1, createdAt: d.createdAt },
    ];
    if (d.version === 2) {
      entries.push(
        { ...base, action: "CHANGES_REQUESTED", actorId: reviewer, fromStatus: "PENDING_REVIEW", toStatus: "CHANGES_REQUESTED", version: 1, createdAt: at(10) },
        { ...base, action: "VERSION_SUBMITTED", actorId: admin.id, fromStatus: "CHANGES_REQUESTED", toStatus: "PENDING_REVIEW", version: 2, createdAt: at(18) },
      );
    }
    if (d.status === "APPROVED") {
      entries.push({ ...base, action: "DELIVERABLE_APPROVED", actorId: reviewer, fromStatus: "PENDING_REVIEW", toStatus: "APPROVED", version: d.version, createdAt: at(24) });
    }
    if (d.status === "CHANGES_REQUESTED") {
      entries.push({ ...base, action: "CHANGES_REQUESTED", actorId: reviewer, fromStatus: "PENDING_REVIEW", toStatus: "CHANGES_REQUESTED", version: d.version, createdAt: at(18) });
    }
    await db.activityLog.createMany({ data: entries });
  }

  // Never log passwords or full user objects; counts are enough.
  const [users, projects, deliverables, comments, activities] = await Promise.all([
    db.user.count(),
    db.project.count(),
    db.deliverable.count(),
    db.comment.count(),
    db.activityLog.count(),
  ]);
  console.log(
    `Seeded ${users} users, ${projects} projects, ${deliverables} deliverables, ${comments} comments, ${activities} activity entries.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
