import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { PermissionsGuard, RequirePermission } from "../../common/guards/permissions.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { FreeDailyWindowService, FreeDailyWindowInput } from "./free-daily-window.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/schedule")
export class FreeDailyWindowAdminController {
  constructor(private svc: FreeDailyWindowService) {}

  @RequirePermission("config", "read")
  @Get()
  list() {
    return this.svc.getAll();
  }

  @RequirePermission("config", "write")
  @Post()
  create(@Body() dto: FreeDailyWindowInput, @CurrentUser() u: any, @Req() req: any) {
    return this.svc.create(dto, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() dto: Partial<FreeDailyWindowInput>,
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    return this.svc.update(id, dto, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() u: any, @Req() req: any) {
    return this.svc.remove(id, u.sub, req.ip);
  }
}
