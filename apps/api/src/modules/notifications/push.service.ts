import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { getMessaging } from "../../config/firebase.config";
import { RealtimeService } from "../../common/realtime/realtime.service";

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger("PushService");

  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private realtime: RealtimeService,
  ) {}

  async sendToUser(userId: string, payload: PushPayload) {
    this.realtime.emitToUser(userId, "notification_new", {
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
    try {
      const tokens = await this.prisma.userPushToken.findMany({ where: { userId } });
      if (!tokens.length) return;
      await Promise.all(tokens.map((t) => this.sendOne(t.token, payload)));
    } catch (e: any) {
      this.logger.warn(`sendToUser failed: ${e.message}`);
    }
  }

  async sendToMultiple(userIds: string[], payload: PushPayload) {
    for (const uid of userIds) {
      this.realtime.emitToUser(uid, "notification_new", {
        title: payload.title,
        body: payload.body,
        data: payload.data,
      });
    }
    try {
      const tokens = await this.prisma.userPushToken.findMany({
        where: { userId: { in: userIds } },
      });
      if (!tokens.length) return;
      await Promise.all(tokens.map((t) => this.sendOne(t.token, payload)));
    } catch (e: any) {
      this.logger.warn(`sendToMultiple failed: ${e.message}`);
    }
  }

  private async sendOne(token: string, payload: PushPayload) {
    const messaging = getMessaging();
    if (!messaging) return;
    try {
      await messaging.send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: this.stringifyData(payload.data),
        android: { priority: "high" },
      });
    } catch (e: any) {
      this.logger.warn(`FCM send error (${token.slice(0, 10)}…): ${e.message}`);
      if (
        e.code === "messaging/registration-token-not-registered" ||
        e.code === "messaging/invalid-argument"
      ) {
        await this.prisma.userPushToken.deleteMany({ where: { token } }).catch(() => {});
      }
    }
  }

  private stringifyData(data?: Record<string, any>) {
    if (!data) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      out[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
    return out;
  }
}
