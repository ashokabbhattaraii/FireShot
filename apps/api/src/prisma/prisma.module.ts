import { Global, Logger, Module } from "@nestjs/common";
import { PrismaClient, prisma as sharedPrisma } from "@fireslot/db";

export const PRISMA = "PRISMA_CLIENT";

const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS ?? "500", 10);

function buildClient(): PrismaClient {
  const isProd = process.env.NODE_ENV === "production";
  const logger = new Logger("Prisma");

  const client = new PrismaClient({
    log: isProd
      ? [{ emit: "event", level: "error" }]
      : [
          { emit: "event", level: "query" },
          { emit: "event", level: "error" },
          { emit: "event", level: "warn" },
        ],
  });

  if (!isProd) {
    (client as any).$on("query", (e: { duration: number; query: string }) => {
      if (e.duration > SLOW_QUERY_MS) {
        logger.warn(`Slow query ${e.duration}ms: ${e.query}`);
      }
    });
    (client as any).$on("warn", (e: { message: string }) => logger.warn(e.message));
  }
  (client as any).$on("error", (e: { message: string }) => logger.error(e.message));

  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: PRISMA,
      useFactory: () => sharedPrisma ?? buildClient(),
    },
  ],
  exports: [PRISMA],
})
export class PrismaModule {}
