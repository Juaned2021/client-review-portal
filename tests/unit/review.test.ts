import { describe, expect, it } from "vitest";
import type { Actor } from "@/server/authz";
import { decideNewVersion, decideReview } from "@/server/review";

const admin: Actor = { id: "u-admin", role: "ADMIN", clientId: null };
const acmeUser: Actor = { id: "u-acme", role: "CLIENT", clientId: "acme" };
const globexUser: Actor = { id: "u-globex", role: "CLIENT", clientId: "globex" };

const review = (overrides: Partial<Parameters<typeof decideReview>[0]> = {}) =>
  decideReview({
    actor: acmeUser,
    projectClientId: "acme",
    currentStatus: "PENDING_REVIEW",
    decision: "APPROVE",
    ...overrides,
  });

describe("decideReview", () => {
  it("lets the project's client approve a pending deliverable", () => {
    expect(review()).toEqual({ ok: true, toStatus: "APPROVED", action: "DELIVERABLE_APPROVED" });
  });

  it("does not require a comment to approve", () => {
    expect(review({ comment: "" }).ok).toBe(true);
  });

  it("cannot approve without being the project's client (other company)", () => {
    expect(review({ actor: globexUser })).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("cannot approve without being the project's client (agency admin)", () => {
    expect(review({ actor: admin })).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("checks permissions before state, so outsiders learn nothing about the status", () => {
    expect(review({ actor: globexUser, currentStatus: "APPROVED" })).toMatchObject({ code: "FORBIDDEN" });
  });

  it.each(["APPROVED", "CHANGES_REQUESTED"] as const)("rejects reviewing a deliverable that is %s", (currentStatus) => {
    expect(review({ currentStatus })).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect(review({ currentStatus, decision: "REQUEST_CHANGES", comment: "Please fix the logo" })).toMatchObject({
      ok: false,
      code: "INVALID_STATE",
    });
  });

  it("requires a comment to request changes", () => {
    expect(review({ decision: "REQUEST_CHANGES" })).toMatchObject({ ok: false, code: "COMMENT_REQUIRED" });
    expect(review({ decision: "REQUEST_CHANGES", comment: null })).toMatchObject({ code: "COMMENT_REQUIRED" });
  });

  it("treats a whitespace-only or too-short comment as missing", () => {
    expect(review({ decision: "REQUEST_CHANGES", comment: "     " })).toMatchObject({ code: "COMMENT_REQUIRED" });
    expect(review({ decision: "REQUEST_CHANGES", comment: " no " })).toMatchObject({ code: "COMMENT_REQUIRED" });
  });

  it("requests changes when a meaningful comment is given", () => {
    expect(review({ decision: "REQUEST_CHANGES", comment: "Hero image is too dark" })).toEqual({
      ok: true,
      toStatus: "CHANGES_REQUESTED",
      action: "CHANGES_REQUESTED",
    });
  });
});

describe("decideNewVersion", () => {
  it("lets the agency resubmit after a change request", () => {
    expect(decideNewVersion({ actor: admin, currentStatus: "CHANGES_REQUESTED" })).toEqual({
      ok: true,
      toStatus: "PENDING_REVIEW",
      action: "VERSION_SUBMITTED",
    });
  });

  it("does not let clients submit versions", () => {
    expect(decideNewVersion({ actor: acmeUser, currentStatus: "CHANGES_REQUESTED" })).toMatchObject({ code: "FORBIDDEN" });
  });

  it.each(["PENDING_REVIEW", "APPROVED"] as const)("rejects a new version while %s", (currentStatus) => {
    expect(decideNewVersion({ actor: admin, currentStatus })).toMatchObject({ code: "INVALID_STATE" });
  });
});
