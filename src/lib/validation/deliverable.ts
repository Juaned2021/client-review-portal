import { z } from "zod";

// Only http(s): blocks `javascript:` and `data:` URLs, which would be an XSS
// vector once rendered as a link.
export const httpUrl = z.url({ protocol: /^https?$/, error: "Enter a valid http(s) URL" }).max(2000);

const id = z.string().trim().min(1).max(64);

export const createDeliverableSchema = z.object({
  projectId: id,
  title: z.string().trim().min(2, { error: "Title must have at least 2 characters" }).max(160),
  linkUrl: httpUrl,
});

export const newVersionSchema = z.object({
  deliverableId: id,
  linkUrl: httpUrl,
});

export const reviewSchema = z.object({
  deliverableId: id,
  decision: z.enum(["APPROVE", "REQUEST_CHANGES"]),
  comment: z.string().trim().max(5000).optional(),
});

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, { error: "Comment cannot be empty" })
  .max(5000, { error: "Comment is too long" });
