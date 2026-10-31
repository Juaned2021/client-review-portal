import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/root";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError({ error, path }) {
      // Log unexpected failures only, with no input or user data.
      if (error.code === "INTERNAL_SERVER_ERROR") console.error(`tRPC ${path ?? "?"} failed:`, error.message);
    },
  });

export { handler as GET, handler as POST };
