import { Global, Logger, Module, OnModuleInit } from "@nestjs/common";
import { PrismaClient, prisma as sharedPrisma } from "@fireslot/db";
import { getMessaging } from "../config/firebase.config";

export const PRISMA = "PRISMA_CLIENT";

const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS ?? "500", 10);
const fcmLogger = new Logger("FCM");

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

function attachPushMiddleware(client: PrismaClient) {
  if (middlewareAttached) return;
  middlewareAttached = true;

  client.$use(async (params, next) => {
    const result = await next(params);

    if (
      params.model === "Notification" &&
      params.action === "create" &&
      result?.userId &&
      result?.title
    ) {
      // Fire async — don't block the response
      setImmediate(() => {
        void sendFcmPush(client, {
          userId: result.userId,
          title: result.title,
          body: result.body ?? null,
          type: result.type ?? "GENERAL",
        }).catch(() => {});
      });
    }

    return result;
  });
}

async function sendFcmPush(
  prisma: PrismaClient,
  notification: { userId: string; title: string; body?: string | null; type?: string },
) {
  const messaging = getMessaging();
  if (!messaging) return;
  const tokens = await prisma.userPushToken.findMany({
    where: { userId: notification.userId },
    select: { token: true },
  });
  if (!tokens.length) return;
  fcmLogger.log(`Sending push to ${tokens.length} device(s) for user ${notification.userId.slice(0, 8)}…`);
  for (const { token } of tokens) {
    try {
      await messaging.send({
        token,
        notification: {
          title: notification.title,
          body: notification.body ?? undefined,
        },
        data: { type: notification.type ?? "GENERAL" },
        android: {
          priority: "high",
          notification: {
            channelId: "fcm_default_channel",
            priority: "high",
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
      });
      fcmLogger.log(`Push sent successfully to ${token.slice(0, 8)}…`);
    } catch (e: any) {
      fcmLogger.warn(`FCM error (${token.slice(0, 8)}…): ${e.message}`);
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
        attachPushMiddleware(client);
        return client;
      },
    },
  ],
  exports: [PRISMA],
})
export class PrismaModule {}
