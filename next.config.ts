import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is intentionally disabled: every page in this portal is
  // per-user and tenant-scoped, so we render dynamically and re-authorize on
  // every request. See docs/DECISIONS.md.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
