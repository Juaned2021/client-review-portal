-- Follow-up migration: purely additive, safe to run against a live database.
--  * New enum + new table: nothing existing is touched.
--  * ADD COLUMN ... NOT NULL DEFAULT 1: on Postgres 11+ a constant default is a
--    metadata-only change (no table rewrite); existing rows read as version 1.
--  * The CHECK constraint is added NOT VALID (no full-table scan under an
--    exclusive lock), then validated separately with a weaker lock.

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('PROJECT_CREATED', 'DELIVERABLE_CREATED', 'VERSION_SUBMITTED', 'DELIVERABLE_APPROVED', 'CHANGES_REQUESTED', 'COMMENT_ADDED');

-- AlterTable
ALTER TABLE "Deliverable" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- Hand-written
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_version_positive_check" CHECK ("version" >= 1) NOT VALID;
ALTER TABLE "Deliverable" VALIDATE CONSTRAINT "Deliverable_version_positive_check";

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "clientId" TEXT NOT NULL,
    "actorId" TEXT,
    "projectId" TEXT,
    "deliverableId" TEXT,
    "fromStatus" "DeliverableStatus",
    "toStatus" "DeliverableStatus",
    "version" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_deliverableId_createdAt_idx" ON "ActivityLog"("deliverableId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_clientId_createdAt_idx" ON "ActivityLog"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_projectId_idx" ON "ActivityLog"("projectId");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
