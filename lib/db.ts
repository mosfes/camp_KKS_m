import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function databaseUrlWithPoolLimits(rawUrl: string | undefined) {
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);

    // Vercel Fluid compute lets one instance serve several requests at once,
    // so a single connection makes concurrent requests queue (and time out
    // under load). 5 keeps total connections modest across instances.
    // Keep explicit URL settings unchanged so infrastructure can override this.
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "5");
    }

    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "10");
    }

    return url.toString();
  } catch {
    // Let Prisma report the original connection-string error without exposing it.
    return rawUrl;
  }
}

const databaseUrl = databaseUrlWithPoolLimits(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  (databaseUrl
    ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    : new PrismaClient());

globalForPrisma.prisma ??= prisma;
