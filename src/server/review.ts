// Deliverable review state machine. Pure functions: no I/O, fully unit-tested.
//
//   PENDING_REVIEW ──(client approves)──────────▶ APPROVED
//   PENDING_REVIEW ──(client requests changes)──▶ CHANGES_REQUESTED
//   CHANGES_REQUESTED ──(admin submits v+1)─────▶ PENDING_REVIEW
//
// APPROVED is final. Requesting changes requires a comment explaining why.

import type { ActivityAction, DeliverableStatus } from "@/generated/prisma/enums";
import { canReviewDeliverable, isAdmin, type Actor } from "@/server/authz";

export const MIN_CHANGE_REQUEST_LENGTH = 5;

export type ReviewDecision = "APPROVE" | "REQUEST_CHANGES";

export type TransitionResult =
  | { ok: true; toStatus: DeliverableStatus; action: ActivityAction }
  | { ok: false; code: "FORBIDDEN" | "INVALID_STATE" | "COMMENT_REQUIRED"; message: string };

export function decideReview(input: {
  actor: Actor;
  projectClientId: string;
  currentStatus: DeliverableStatus;
  decision: ReviewDecision;
  comment?: string | null;
}): TransitionResult {
  const { actor, projectClientId, currentStatus, decision } = input;

  if (!canReviewDeliverable(actor, projectClientId)) {
    return { ok: false, code: "FORBIDDEN", message: "Only the project's client can review this deliverable." };
  }
  if (currentStatus !== "PENDING_REVIEW") {
    return { ok: false, code: "INVALID_STATE", message: "This deliverable is not awaiting review." };
  }

  if (decision === "APPROVE") {
    return { ok: true, toStatus: "APPROVED", action: "DELIVERABLE_APPROVED" };
  }

  const comment = input.comment?.trim() ?? "";
  if (comment.length < MIN_CHANGE_REQUEST_LENGTH) {
    return { ok: false, code: "COMMENT_REQUIRED", message: "Please explain what needs to change." };
  }
  return { ok: true, toStatus: "CHANGES_REQUESTED", action: "CHANGES_REQUESTED" };
}

/** The agency answers a change request by submitting a new version for review. */
export function decideNewVersion(input: { actor: Actor; currentStatus: DeliverableStatus }): TransitionResult {
  if (!isAdmin(input.actor)) {
    return { ok: false, code: "FORBIDDEN", message: "Only the agency can submit new versions." };
  }
  if (input.currentStatus !== "CHANGES_REQUESTED") {
    return { ok: false, code: "INVALID_STATE", message: "A new version can only follow a change request." };
  }
  return { ok: true, toStatus: "PENDING_REVIEW", action: "VERSION_SUBMITTED" };
}
