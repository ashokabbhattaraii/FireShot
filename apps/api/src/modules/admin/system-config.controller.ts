import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ConfigCategory } from "@fireslot/db";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { PermissionsGuard, RequirePermission } from "../../common/guards/permissions.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SystemConfigService } from "./system-config.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/config")
export class SystemConfigController {
  constructor(private svc: SystemConfigService) {}

  @RequirePermission("config", "read")
  @Get()
  async all() {
    const items = await this.svc.getAll();
    return items.reduce((acc: Record<string, any[]>, c) => {
      (acc[c.category] ||= []).push(c);
      return acc;
    }, {});
  }

  @RequirePermission("config", "read")
  @Get("category/:cat")
  byCategory(@Param("cat") cat: ConfigCategory) {
    return this.svc.getByCategory(cat);
  }

  @RequirePermission("config", "write")
  @Put(":key")
  update(
    @Param("key") key: string,
    @Body() body: { value: string },
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    return this.svc.set(key, body.value, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Post("bulk")
  bulk(
    @Body() body: { updates: { key: string; value: string }[] },
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    return this.svc.bulkSet(body.updates, u.sub, req.ip);
  }
}
