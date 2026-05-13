import {
  Body,
  Controller,
  Delete,
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
import { PermissionInput, RolesService } from "./roles.service";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin")
export class RolesController {
  constructor(private svc: RolesService) {}

  @RequirePermission("config", "read")
  @Get("roles")
  list() {
    return this.svc.getRolesWithCounts();
  }

  @RequirePermission("config", "write")
  @Post("roles")
  create(
    @Body() body: { name: string; permissions: PermissionInput[] },
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    return this.svc.createRole(body.name, body.permissions, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Put("roles/:id/permissions")
  updatePerms(
    @Param("id") id: string,
    @Body() body: { permissions: PermissionInput[] },
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    return this.svc.updatePermissions(id, body.permissions, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Delete("roles/:id")
  remove(@Param("id") id: string, @CurrentUser() u: any, @Req() req: any) {
    return this.svc.deleteRole(id, u.sub, req.ip);
  }

  @RequirePermission("config", "read")
  @Get("users/:id/access")
  access(@Param("id") id: string) {
    return this.svc.getUserAccess(id);
  }

  @RequirePermission("config", "write")
  @Put("users/:id/access")
  async setAccess(
    @Param("id") id: string,
    @Body()
    body: {
      roleId?: string;
      overrides: { resource: string; action: string; effect: "ALLOW" | "DENY" }[];
    },
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    if (body.roleId) await this.svc.assignRole(id, body.roleId, u.sub, req.ip);
    return this.svc.setUserOverrides(id, body.overrides, u.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Put("users/:id/role")
  assign(
    @Param("id") id: string,
    @Body() body: { roleId: string },
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    return this.svc.assignRole(id, body.roleId, u.sub, req.ip);
  }

  @RequirePermission("users", "read")
  @Get("roles/:id/users")
  users(
    @Param("id") id: string,
    @Query("page") page = "1",
    @Query("limit") limit = "25",
  ) {
    return this.svc.getRoleUsers(id, parseInt(page, 10), parseInt(limit, 10));
  }
}
