import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var hestiatPrisma: PrismaClient | undefined;
}

export const prisma =
  global.hestiatPrisma ??
  new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") {
  global.hestiatPrisma = prisma;
}
