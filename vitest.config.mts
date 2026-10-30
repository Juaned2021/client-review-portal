import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React Server environment; tests run in plain Node.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    projects: [
      // Pure logic: no database, runs everywhere (`npm test`).
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      // Needs a migrated + seeded Postgres (`npm run test:integration`).
      {
        extends: true,
        test: { name: "integration", include: ["tests/integration/**/*.int.test.ts"], setupFiles: ["dotenv/config"] },
      },
    ],
  },
});
