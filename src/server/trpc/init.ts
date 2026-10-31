import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError, z } from "zod";
import type { SessionUser } from "@/server/session";

/**
 * The context only declares its shape here. It is built per request in
 * `context.ts` (which reads the session cookie), so routers stay free of the
 * Next.js runtime and can be called directly in tests with any user.
 */
export type TRPCContext = { user: SessionUser | null };

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Expose validation messages to the client, never stack traces or internals.
        zodError:
          error.cause instanceof ZodError
            ? (z.flattenError(error.cause).fieldErrors as Record<string, string[] | undefined>)
            : null,
      },
    };
  },
});

export const router = t.router;

/** Every procedure in this app requires a signed-in user. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { user: ctx.user } });
});
