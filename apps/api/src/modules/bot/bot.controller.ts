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
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { BotJobService } from "./bot-job.service";
import { BotAccuracyService } from "./bot-accuracy.service";
import { BotRollbackService } from "./bot-rollback.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/bot")
export class BotController {
  constructor(
    private svc: BotJobService,
    private accuracy: BotAccuracyService,
    private rollbacks: BotRollbackService,
  ) {}

  // -------- Jobs --------
  @RequirePermission("config", "write")
  @Get("jobs")
  jobs() {
    return this.svc.getStatus();
  }

  @RequirePermission("config", "write")
  @Put("jobs/:name/toggle")
  toggle(@Param("name") name: string, @Body() body: { enabled: boolean }, @CurrentUser() u: any, @Req() req: any) {
    return this.svc.toggle(name, !!body.enabled, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Put("jobs/:name/dry-run")
  dryRun(@Param("name") name: string, @Body() body: { dryRun: boolean }, @CurrentUser() u: any, @Req() req: any) {
    return this.svc.toggleDryRun(name, !!body.dryRun, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Put("jobs/:name/interval")
  interval(@Param("name") name: string, @Body() body: { intervalMins: number }, @CurrentUser() u: any, @Req() req: any) {
    return this.svc.updateInterval(name, body.intervalMins, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Put("jobs/:name/config")
  config(@Param("name") name: string, @Body() body: { config: Record<string, any> }, @CurrentUser() u: any, @Req() req: any) {
    return this.svc.updateConfig(name, body.config, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Put("jobs/:name/max-actions")
  maxActions(@Param("name") name: string, @Body() body: { maxActionsPerRun: number }, @CurrentUser() u: any, @Req() req: any) {
    return this.svc.updateMaxActions(name, body.maxActionsPerRun, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Post("jobs/:name/run")
  run(@Param("name") name: string, @CurrentUser() u: any, @Req() req: any) {
    return this.svc.triggerManual(name, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Get("logs")
  logs(
    @Query("jobName") jobName?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.svc.getLogs({ jobName, status, from, to }, parseInt(page, 10), parseInt(limit, 10));
  }

  // -------- Flags --------
  @RequirePermission("config", "write")
  @Get("flags")
  flags(
    @Query("jobName") jobName?: string,
    @Query("status") status?: string,
    @Query("severity") severity?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "25",
  ) {
    return this.accuracy.listFlags(
      { jobName, status, severity },
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @RequirePermission("config", "write")
  @Post("flags/:id/review")
  review(
    @Param("id") id: string,
    @Body() body: { wasCorrect: boolean; note?: string },
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    return this.accuracy.recordReview(id, !!body.wasCorrect, body.note, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Post("flags/:id/ignore")
  ignore(@Param("id") id: string, @CurrentUser() u: any, @Req() req: any) {
    return this.accuracy.ignoreFlag(id, u.sub, req.ip);
  }

  // -------- Rollback --------
  @RequirePermission("config", "write")
  @Get("rollbacks")
  rollbackList(
    @Query("jobName") jobName?: string,
    @Query("rolledBack") rolledBack?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "25",
  ) {
    return this.rollbacks.listRollbacks(
      {
        jobName,
        rolledBack: rolledBack === undefined ? undefined : rolledBack === "true",
      },
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @RequirePermission("config", "write")
  @Post("rollback/:id")
  rollback(@Param("id") id: string, @CurrentUser() u: any, @Req() req: any) {
    return this.rollbacks.rollback(id, u.sub, req.ip);
  }
}
