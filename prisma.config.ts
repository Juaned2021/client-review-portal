import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI (migrate, seed) needs a direct, non-pooled connection.
    // On Supabase set DIRECT_URL to the session/direct connection (port 5432)
    // and DATABASE_URL to the transaction pooler (port 6543) used at runtime.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
