import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ActivityAction, DeliverableStatus } from "@/generated/prisma/enums";

/**
 * The only fields an activity entry may carry. Deliberately no free text:
 * comment bodies, emails or names never end up in the audit log.
 */
export type ActivityEntry = {
  action: ActivityAction;
  clientId: string;
  actorId: string;
  projectId?: string;
  deliverableId?: string;
  fromStatus?: DeliverableStatus;
  toStatus?: DeliverableStatus;
  version?: number;
};

/** Always called inside the same transaction as the change it records. */
export function logActivity(tx: Prisma.TransactionClient, entry: ActivityEntry) {
  return tx.activityLog.create({ data: entry, select: { id: true } });
}
