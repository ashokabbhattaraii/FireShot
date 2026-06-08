import { Global, Logger, Module } from "@nestjs/common";
import { PrismaClient, prisma as sharedPrisma } from "@fireslot/db";
import { getMessaging } from "../config/firebase.config";

export const PRISMA = "PRISMA_CLIENT";

const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS ?? "500", 10);
const fcmLogger = new Logger("FCM");

function withFcmPush(base: PrismaClient) {
  return base.$extends({
    query: {
      notification: {
        async create({ args, query }) {
          const result = await query(args);
          if (result && 'userId' in result && result.userId && result.title) {
            void sendFcmPush(base, { userId: result.userId as string, title: result.title as string, body: (result as any).body, type: (result as any).type }).catch(() => {});
          }
          return result;
        },
        async createMany({ args, query }) {
          const result = await query(args);
          // createMany doesn't return records, fire push for batch via data array
          if (Array.isArray(args.data)) {
            for (const item of args.data) {
              if (item.userId && item.title) {
                void sendFcmPush(base, item as any).catch(() => {});
              }
            }
          }
          return result;
        },
      },
    },
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
  for (const { token } of tokens) {
    try {
      await messaging.send({
        token,
        notification: { title: notification.title, body: notification.body ?? undefined },
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
      useFactory: () => {
        const base = sharedPrisma ?? buildClient();
        return withFcmPush(base) as unknown as PrismaClient;
      },
    },
  ],
  exports: [PRISMA],
})
export class PrismaModule {}
