import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  assertAdmin,
  canAccessClient,
  canComment,
  canManageProjects,
  canReviewDeliverable,
  clientIdFilter,
  commentScope,
  deliverableScope,
  projectScope,
  type Actor,
} from "@/server/authz";

const admin: Actor = { id: "u-admin", role: "ADMIN", clientId: null };
const acmeUser: Actor = { id: "u-acme", role: "CLIENT", clientId: "acme" };
const globexUser: Actor = { id: "u-globex", role: "CLIENT", clientId: "globex" };
const brokenClient: Actor = { id: "u-broken", role: "CLIENT", clientId: null };

describe("scope builders", () => {
  it("admins get an unrestricted scope", () => {
    expect(projectScope(admin)).toEqual({});
    expect(deliverableScope(admin)).toEqual({});
    expect(commentScope(admin)).toEqual({});
    expect(clientIdFilter(admin)).toBeNull();
  });

  it("client users are always restricted to their own company", () => {
    expect(projectScope(acmeUser)).toEqual({ clientId: "acme" });
    expect(deliverableScope(acmeUser)).toEqual({ project: { clientId: "acme" } });
    expect(commentScope(acmeUser)).toEqual({ deliverable: { project: { clientId: "acme" } } });
    expect(clientIdFilter(acmeUser)).toBe("acme");
  });

  it("two companies never share a scope", () => {
    expect(projectScope(acmeUser)).not.toEqual(projectScope(globexUser));
  });

  it("fails closed for a client user without a company instead of returning everything", () => {
    expect(() => projectScope(brokenClient)).toThrow(AuthorizationError);
    expect(() => deliverableScope(brokenClient)).toThrow(AuthorizationError);
    expect(() => commentScope(brokenClient)).toThrow(AuthorizationError);
    expect(() => clientIdFilter(brokenClient)).toThrow(AuthorizationError);
  });
});

describe("canAccessClient", () => {
  it("admin can access any company", () => {
    expect(canAccessClient(admin, "acme")).toBe(true);
    expect(canAccessClient(admin, "globex")).toBe(true);
  });

  it("client can access only their own company", () => {
    expect(canAccessClient(acmeUser, "acme")).toBe(true);
    expect(canAccessClient(acmeUser, "globex")).toBe(false);
  });

  it("a client with no company can access nothing", () => {
    expect(canAccessClient(brokenClient, "acme")).toBe(false);
  });
});

describe("canReviewDeliverable", () => {
  it("only the project's own client can review", () => {
    expect(canReviewDeliverable(acmeUser, "acme")).toBe(true);
  });

  it("another company's user cannot review", () => {
    expect(canReviewDeliverable(globexUser, "acme")).toBe(false);
  });

  it("the agency cannot approve its own work", () => {
    expect(canReviewDeliverable(admin, "acme")).toBe(false);
  });
});

describe("canComment", () => {
  it("admin and the project's client can comment; other companies cannot", () => {
    expect(canComment(admin, "acme")).toBe(true);
    expect(canComment(acmeUser, "acme")).toBe(true);
    expect(canComment(globexUser, "acme")).toBe(false);
  });
});

describe("project management", () => {
  it("is admin-only", () => {
    expect(canManageProjects(admin)).toBe(true);
    expect(canManageProjects(acmeUser)).toBe(false);
    expect(() => assertAdmin(admin)).not.toThrow();
    expect(() => assertAdmin(acmeUser)).toThrow(AuthorizationError);
  });
});
