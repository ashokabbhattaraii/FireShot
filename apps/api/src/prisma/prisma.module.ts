import { Global, Logger, Module } from "@nestjs/common";
import { PrismaClient, prisma as sharedPrisma } from "@fireslot/db";
import { getMessaging } from "../config/firebase.config";

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

let middlewareAttached = false;

function attachFcmMiddleware(client: PrismaClient) {
  if (middlewareAttached) return;
  middlewareAttached = true;
  client.$use(async (params, next) => {
    const result = await next(params);
    if (params.model === "Notification" && params.action === "create" && result?.userId) {
      void sendFcmForNotification(client, result).catch(() => {});
    }
    return result;
  });
}

async function sendFcmForNotification(
  prisma: PrismaClient,
  notification: { userId: string; title: string; body?: string | null; type?: string },
) {
  const messaging = getMessaging();
  if (!messaging) return;
  const tokens = await prisma.userPushToken.findMany({
    where: { userId: notification.userId },
    select: { token: true, id: true },
  });
  if (!tokens.length) return;
  const logger = new Logger("FCM");
  for (const { token } of tokens) {
    try {
      await messaging.send({
        token,
        notification: { title: notification.title, body: notification.body ?? undefined },
        data: { type: notification.type ?? "GENERAL" },
        android: { priority: "high" },
      });
    } catch (e: any) {
      logger.warn(`FCM send error: ${e.message}`);
      if (
        e.code === "messaging/registration-token-not-registered" ||
        e.code === "messaging/invalid-argument"
      ) {
        await prisma.userPushToken.deleteMany({ where: { token } }).catch(() => {});
      }
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PRISMA,
      useFactory: () => {
        const client = sharedPrisma ?? buildClient();
        attachFcmMiddleware(client);
        return client;
      },
    },
  ],
  exports: [PRISMA],
})
export class PrismaModule {}
