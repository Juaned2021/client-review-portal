import "server-only";
import { router } from "./init";
import { commentRouter } from "./routers/comment";

export const appRouter = router({
  comment: commentRouter,
});

/** Only the *type* crosses to the client: no server code is bundled into the browser. */
export type AppRouter = typeof appRouter;
