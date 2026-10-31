import "server-only";
import { getCurrentUser } from "@/server/session";
import type { TRPCContext } from "./init";

/** Built once per HTTP request. The user is reloaded from the DB (role/company always fresh). */
export async function createTRPCContext(): Promise<TRPCContext> {
  return { user: await getCurrentUser() };
}
