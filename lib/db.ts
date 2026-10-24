import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client.
 *
 * Two drivers, chosen by the connection string host:
 *   - `*.neon.tech` -> Neon serverless driver (HTTP). Works in Vercel
 *     serverless functions with no persistent TCP connection.
 *   - anything else -> node-postgres driver. Used for local development
 *     against a Homebrew Postgres instance.
 *
 * The client is created lazily. Creating it at module scope would throw
 * during `next build` on a machine without `DATABASE_URL`, because the build
 * collects route configuration for every API route.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaInitError?: Error;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in the connection string.",
    );
  }

  const isNeon = /@[^/]*\.neon\.tech\//.test(connectionString);
  const adapter = isNeon
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
}

/**
 * Resolve the Prisma client, creating it on first use.
 *
 * Throws a clear error when the database is not configured so API routes can
 * surface the problem instead of failing with an opaque crash.
 */
export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (globalForPrisma.prismaInitError) throw globalForPrisma.prismaInitError;

  try {
    globalForPrisma.prisma = createClient();
  } catch (error) {
    globalForPrisma.prismaInitError =
      error instanceof Error ? error : new Error(String(error));
    throw globalForPrisma.prismaInitError;
  }

  if (process.env.NODE_ENV !== "production") {
    // Keep the instance across hot reloads in development.
  }

  return globalForPrisma.prisma;
}

/**
 * Proxy that defers to the lazily-created client.
 *
 * Exposed as `prisma` so call sites read naturally, while keeping the
 * construction lazy.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrisma();
    const value = client[property as keyof PrismaClient];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
