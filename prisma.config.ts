import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * Connection strings live here rather than in `schema.prisma`. Migrations run
 * through the Neon adapter so the same pooler/direct endpoint works for both
 * the CLI and the application.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
