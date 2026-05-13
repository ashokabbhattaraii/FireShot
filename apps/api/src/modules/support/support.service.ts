import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient, TicketCategory, TicketPriority, TicketStatus } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { AdminActionLogService } from "../admin/admin-action-log.service";

const AUTO_REPLY: Record<string, string> = {
  PAYMENT_ISSUE: "Your payment is being reviewed. Usually approved within 2 hours.",
  WITHDRAWAL_ISSUE: "Withdrawals are processed within 24 hours.",
  RESULT_DISPUTE: "Our team will review the match results within 12 hours.",
};
const AUTO_REPLY_DEFAULT = "We received your ticket. Our support team will reply shortly.";

@Injectable()
export class SupportService {
  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private logs: AdminActionLogService,
  ) {}

  async createTicket(
    userId: string,
    dto: {
      category: TicketCategory;
      subject: string;
      message: string;
      relatedTournamentId?: string;
      relatedPaymentId?: string;
    },
  ) {
    const count = await this.prisma.supportTicket.count();
    const ticketNumber = `TKT-${String(count + 1).padStart(4, "0")}`;

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId,
        subject: dto.subject,
        category: dto.category,
        relatedTournamentId: dto.relatedTournamentId,
        relatedPaymentId: dto.relatedPaymentId,
        messages: {
          create: { senderId: userId, senderRole: "PLAYER", message: dto.message },
        },
      },
      include: { messages: true },
    });

    await this.autoReply(ticket.id, dto.category);

    // Notify admins/support
    const supportAdmins = await this.prisma.user.findMany({
      where: { roleRef: { name: { in: ["SUPER_ADMIN", "ADMIN", "SUPPORT"] } } },
      select: { id: true },
    });
    await this.prisma.notification.createMany({
      data: supportAdmins.map((a) => ({
        userId: a.id,
        type: "SYSTEM" as const,
        title: `New ticket ${ticketNumber}`,
        body: dto.subject,
      })),
    });

    return this.getTicketById(ticket.id, userId, "PLAYER");
  }

  async autoReply(ticketId: string, category: TicketCategory) {
    const message = AUTO_REPLY[category] ?? AUTO_REPLY_DEFAULT;
    return this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderId: "system",
        senderRole: "BOT",
        message,
      },
    });
  }

  async getTickets(
    filters: {
      status?: TicketStatus;
      category?: TicketCategory;
      priority?: TicketPriority;
      assignedTo?: string;
      userId?: string;
    },
    page = 1,
    limit = 25,
  ) {
    const where: any = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) where[k] = v;
    });
    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true, profile: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getTicketById(id: string, requesterId: string, requesterRole: "PLAYER" | "ADMIN") {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, profile: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!ticket) throw new NotFoundException();
    if (requesterRole === "PLAYER") {
      if (ticket.userId !== requesterId) throw new ForbiddenException("Not your ticket");
      return {
        ...ticket,
        messages: ticket.messages.filter((m) => !m.isInternal),
      };
    }
    return ticket;
  }

  async replyToTicket(
    ticketId: string,
    senderId: string,
    senderRole: "PLAYER" | "ADMIN" | "SUPPORT",
    message: string,
    isInternal = false,
    attachmentUrl?: string,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException();
    if (senderRole === "PLAYER") {
      if (ticket.userId !== senderId) throw new ForbiddenException("Not your ticket");
      if (isInternal) throw new BadRequestException("Players cannot post internal notes");
    }
    if (ticket.status === "CLOSED") throw new BadRequestException("Ticket is closed");

    await this.prisma.ticketMessage.create({
      data: { ticketId, senderId, senderRole, message, isInternal, attachmentUrl },
    });

    let nextStatus: TicketStatus = ticket.status;
    if (senderRole === "PLAYER" && ticket.status === "AWAITING_PLAYER") nextStatus = "IN_PROGRESS";
    if ((senderRole === "ADMIN" || senderRole === "SUPPORT") && ticket.status === "OPEN")
      nextStatus = "IN_PROGRESS";

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: nextStatus, updatedAt: new Date() },
    });

    if (!isInternal) {
      const recipientId = senderRole === "PLAYER" ? ticket.assignedTo : ticket.userId;
      if (recipientId) {
        await this.prisma.notification.create({
          data: {
            userId: recipientId,
            type: "SYSTEM",
            title: `Reply on ${ticket.ticketNumber}`,
            body: message.slice(0, 120),
          },
        });
      }
    }
    return updated;
  }

  async assignTicket(ticketId: string, adminId: string, assignedTo: string, ip?: string | null) {
    const before = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!before) throw new NotFoundException();
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedTo, status: "ASSIGNED" },
    });
    await this.logs.log(adminId, "ticket.assign", "ticket", ticketId, { assignedTo: before.assignedTo }, { assignedTo }, ip);
    await this.prisma.notification.create({
      data: {
        userId: assignedTo,
        type: "SYSTEM",
        title: `Ticket ${before.ticketNumber} assigned`,
        body: before.subject,
      },
    });
    return updated;
  }

  async updateStatus(ticketId: string, adminId: string, status: TicketStatus, ip?: string | null) {
    const before = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!before) throw new NotFoundException();
    const data: any = { status };
    if (status === "RESOLVED") data.resolvedAt = new Date();
    const updated = await this.prisma.supportTicket.update({ where: { id: ticketId }, data });
    await this.logs.log(adminId, "ticket.status", "ticket", ticketId, { status: before.status }, { status }, ip);
    return updated;
  }

  async updatePriority(ticketId: string, adminId: string, priority: TicketPriority, ip?: string | null) {
    const before = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!before) throw new NotFoundException();
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { priority },
    });
    await this.logs.log(adminId, "ticket.priority", "ticket", ticketId, { priority: before.priority }, { priority }, ip);
    return updated;
  }

  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [open, assigned, inProgress, resolvedToday, resolved] = await Promise.all([
      this.prisma.supportTicket.count({ where: { status: "OPEN" } }),
      this.prisma.supportTicket.count({ where: { status: "ASSIGNED" } }),
      this.prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
      this.prisma.supportTicket.count({ where: { status: "RESOLVED", resolvedAt: { gte: todayStart } } }),
      this.prisma.supportTicket.findMany({
        where: { status: "RESOLVED", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
        take: 200,
      }),
    ]);

    const avgResolutionHours = resolved.length
      ? resolved.reduce((s, t) => s + (t.resolvedAt!.getTime() - t.createdAt.getTime()), 0) /
        resolved.length /
        3_600_000
      : 0;

    return {
      open,
      assigned,
      inProgress,
      resolvedToday,
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
    };
  }
}
