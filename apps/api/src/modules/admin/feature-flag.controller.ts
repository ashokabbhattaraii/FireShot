import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import {
  PermissionsGuard,
  RequirePermission,
} from "../../common/guards/permissions.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { FeatureFlagService } from "./feature-flag.service";

@Controller("app")
export class FeatureFlagPublicController {
  constructor(private svc: FeatureFlagService) {}

  @Get("flags")
  getPublic() {
    return this.svc.getPublic();
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/flags")
export class FeatureFlagAdminController {
  constructor(private svc: FeatureFlagService) {}

  @RequirePermission("config", "read")
  @Get()
  list() {
    return this.svc.getAll();
  }

  @RequirePermission("config", "toggle")
  @Put(":key")
  toggle(
    @Param("key") key: string,
    @Body() body: { enabled: boolean },
    @CurrentUser() u: any,
  ) {
    return this.svc.toggle(key, body.enabled, u.sub);
  }
}
