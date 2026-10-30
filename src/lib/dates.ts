// Date handling rules for the whole app:
//
// - Instants (createdAt, ...) are `timestamptz` in Postgres. They travel to the
//   browser as ISO-8601 UTC strings and are formatted in the viewer's time zone
//   on the client (see components/local-time.tsx).
// - Calendar dates (dueDate) are `date` in Postgres and are handled as
//   "YYYY-MM-DD" strings. They are never converted through the local time zone:
//   `new Date("2026-12-15")` is UTC midnight, which is Dec 14 at 19:00 in UTC-5,
//   so formatting it in local time would show the previous day.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" -> Date at UTC midnight (what Prisma expects for a `@db.Date` column). */
export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new RangeError(`Invalid date-only value: ${value}`);
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  // Reject impossible dates such as 2026-02-30, which Date.UTC would roll over.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m! - 1 || date.getUTCDate() !== d) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  return date;
}

/** Date from a `@db.Date` column -> "YYYY-MM-DD", using UTC parts only. */
export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Human format for a calendar date. Formatting in UTC guarantees the day never shifts. */
export function formatDateOnly(value: string | Date, locale = "en-US"): string {
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

/** Today's calendar date in a given IANA time zone, as "YYYY-MM-DD". */
export function todayInTimeZone(timeZone: string, now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
