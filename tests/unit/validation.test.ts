import { describe, expect, it } from "vitest";
import { loginSchema, safeCallbackUrl } from "@/lib/validation/auth";
import { commentBodySchema, createDeliverableSchema, httpUrl } from "@/lib/validation/deliverable";
import { projectFiltersSchema } from "@/lib/validation/project";

describe("httpUrl", () => {
  it("accepts http and https links", () => {
    expect(httpUrl.safeParse("https://www.figma.com/file/abc").success).toBe(true);
    expect(httpUrl.safeParse("http://example.com").success).toBe(true);
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "ftp://example.com/x", "not a url"])(
    "rejects %s (XSS / unsupported scheme)",
    (value) => {
      expect(httpUrl.safeParse(value).success).toBe(false);
    },
  );

  it("is enforced when creating a deliverable", () => {
    expect(createDeliverableSchema.safeParse({ projectId: "p1", title: "Logo", linkUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("safeCallbackUrl (open-redirect protection)", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeCallbackUrl("/projects?status=ACTIVE")).toBe("/projects?status=ACTIVE");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", ""])(
    "falls back to the dashboard for %s",
    (value) => {
      expect(safeCallbackUrl(value)).toBe("/dashboard");
    },
  );

  it("ignores non-string input", () => {
    expect(safeCallbackUrl(null)).toBe("/dashboard");
  });
});

describe("loginSchema", () => {
  it("normalizes emails to lowercase", () => {
    expect(loginSchema.parse({ email: "  Carla@Acme.TEST ", password: "x" }).email).toBe("carla@acme.test");
  });
});

describe("commentBodySchema", () => {
  it("rejects blank and oversized comments", () => {
    expect(commentBodySchema.safeParse("   ").success).toBe(false);
    expect(commentBodySchema.safeParse("a".repeat(5001)).success).toBe(false);
    expect(commentBodySchema.parse("  Looks good  ")).toBe("Looks good");
  });
});

describe("projectFiltersSchema", () => {
  it("drops unknown status values instead of failing the page", () => {
    expect(projectFiltersSchema.parse({ status: "HACKED", q: "brand" })).toEqual({ status: undefined, q: "brand" });
  });
});
