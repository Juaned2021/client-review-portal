import { z } from "zod";
import { parseDateOnly } from "@/lib/dates";

export const PROJECT_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED"] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);

const id = z.string().trim().min(1).max(64);

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, { error: "Name must have at least 2 characters" }).max(120),
  clientId: id,
  status: projectStatusSchema.default("ACTIVE"),
  // <input type="date"> sends "" when empty and "YYYY-MM-DD" otherwise.
  dueDate: z
    .union([z.literal(""), z.iso.date({ error: "Invalid date" })])
    .optional()
    .transform((v) => (v ? parseDateOnly(v) : null)),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Search params are untrusted user input too. Invalid values fall back to
 * "no filter" instead of erroring, so a mangled URL still renders a page.
 */
export const projectFiltersSchema = z.object({
  status: projectStatusSchema.optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
});

export type ProjectFilters = z.infer<typeof projectFiltersSchema>;

/** Next.js gives `string | string[] | undefined`; keep only the first value. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
