import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { PermissionsGuard, RequirePermission } from "../../common/guards/permissions.guard";
import { FeatureFlagGuard, UseFeatureFlag } from "../../common/guards/feature-flag.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SupportService } from "./support.service";
import { TicketCategory, TicketPriority, TicketStatus } from "@fireslot/db";

@UseGuards(JwtAuthGuard)
@Controller("support/tickets")
export class SupportPlayerController {
  constructor(private svc: SupportService) {}

  @UseGuards(FeatureFlagGuard)
  @UseFeatureFlag("SUPPORT_ENABLED")
  @Post()
  create(
    @CurrentUser() u: any,
    @Body()
    body: {
      category: TicketCategory;
      subject: string;
      message: string;
      relatedTournamentId?: string;
      relatedPaymentId?: string;
    },
  ) {
    return this.svc.createTicket(u.sub, body);
  }

  @Get()
  list(@CurrentUser() u: any, @Query("page") page = "1", @Query("limit") limit = "25") {
    return this.svc.getTickets({ userId: u.sub }, parseInt(page, 10), parseInt(limit, 10));
  }

  @Get(":id")
  one(@Param("id") id: string, @CurrentUser() u: any) {
    return this.svc.getTicketById(id, u.sub, "PLAYER");
  }

  @Post(":id/reply")
  reply(
    @Param("id") id: string,
    @CurrentUser() u: any,
    @Body() body: { message: string; attachmentUrl?: string },
  ) {
    return this.svc.replyToTicket(id, u.sub, "PLAYER", body.message, false, body.attachmentUrl);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/support")
export class SupportAdminController {
  constructor(private svc: SupportService) {}

  @RequirePermission("users", "read")
  @Get("stats")
  stats() {
    return this.svc.getStats();
  }

  @RequirePermission("users", "read")
  @Get("tickets")
  list(
    @Query("status") status?: TicketStatus,
    @Query("category") category?: TicketCategory,
    @Query("priority") priority?: TicketPriority,
    @Query("assignedTo") assignedTo?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "25",
  ) {
    return this.svc.getTickets(
      { status, category, priority, assignedTo },
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @RequirePermission("users", "read")
  @Get("tickets/:id")
  one(@Param("id") id: string, @CurrentUser() u: any) {
    return this.svc.getTicketById(id, u.sub, "ADMIN");
  }

  @RequirePermission("users", "read")
  @Post("tickets/:id/reply")
  reply(
    @Param("id") id: string,
    @CurrentUser() u: any,
    @Body() body: { message: string; isInternal?: boolean; attachmentUrl?: string },
  ) {
    return this.svc.replyToTicket(
      id,
      u.sub,
      "ADMIN",
      body.message,
      !!body.isInternal,
      body.attachmentUrl,
    );
  }

  @RequirePermission("users", "read")
  @Put("tickets/:id/assign")
  assign(
    @Param("id") id: string,
    @CurrentUser() u: any,
    @Req() req: any,
    @Body() body: { assignedTo: string },
  ) {
    return this.svc.assignTicket(id, u.sub, body.assignedTo, req.ip);
  }

  @RequirePermission("users", "read")
  @Put("tickets/:id/status")
  status(
    @Param("id") id: string,
    @CurrentUser() u: any,
    @Req() req: any,
    @Body() body: { status: TicketStatus },
  ) {
    return this.svc.updateStatus(id, u.sub, body.status, req.ip);
  }

  @RequirePermission("users", "read")
  @Put("tickets/:id/priority")
  priority(
    @Param("id") id: string,
    @CurrentUser() u: any,
    @Req() req: any,
    @Body() body: { priority: TicketPriority },
  ) {
    return this.svc.updatePriority(id, u.sub, body.priority, req.ip);
  }
}
