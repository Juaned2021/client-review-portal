// Regression test: a date-only field must not shift by a day for users in UTC-5.
// Run the whole file as if the server/browser lived in Bogotá (UTC-5, no DST).
process.env.TZ = "America/Bogota";

import { describe, expect, it } from "vitest";
import { formatDateOnly, parseDateOnly, toDateOnlyString, todayInTimeZone } from "@/lib/dates";
import { createProjectSchema } from "@/lib/validation/project";

describe("date-only handling in UTC-5", () => {
  it("really runs in UTC-5", () => {
    expect(new Date(2026, 11, 15).getTimezoneOffset()).toBe(300);
  });

  it("documents the bug we guard against: naive local formatting shows the previous day", () => {
    // "2026-12-15" parses as UTC midnight = Dec 14, 19:00 in Bogotá.
    expect(new Date("2026-12-15").toLocaleDateString("en-US")).toBe("12/14/2026");
  });

  it("formats a due date on the same calendar day", () => {
    expect(formatDateOnly("2026-12-15")).toBe("Dec 15, 2026");
    expect(formatDateOnly("2027-01-01")).toBe("Jan 1, 2027");
  });

  it("round-trips through the form -> DB -> UI path without shifting", () => {
    const { dueDate } = createProjectSchema.parse({ name: "Launch", clientId: "c1", dueDate: "2026-12-15" });
    expect(dueDate?.toISOString()).toBe("2026-12-15T00:00:00.000Z"); // what Prisma writes to the DATE column
    expect(toDateOnlyString(dueDate!)).toBe("2026-12-15"); // what we send to the client
    expect(formatDateOnly(toDateOnlyString(dueDate!))).toBe("Dec 15, 2026"); // what the user sees
  });

  it("treats an empty date input as no due date", () => {
    expect(createProjectSchema.parse({ name: "Launch", clientId: "c1", dueDate: "" }).dueDate).toBeNull();
  });

  it("rejects impossible or malformed dates", () => {
    expect(() => parseDateOnly("2026-02-30")).toThrow(RangeError);
    expect(() => parseDateOnly("15/12/2026")).toThrow(RangeError);
    expect(createProjectSchema.safeParse({ name: "Launch", clientId: "c1", dueDate: "2026-13-01" }).success).toBe(false);
  });

  it("computes 'today' in the user's zone, not UTC", () => {
    const lateEvening = new Date("2026-12-16T03:00:00Z"); // 22:00 on Dec 15 in Bogotá
    expect(todayInTimeZone("America/Bogota", lateEvening)).toBe("2026-12-15");
    expect(todayInTimeZone("UTC", lateEvening)).toBe("2026-12-16");
  });
});
