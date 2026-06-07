import { Module } from "@nestjs/common";
import { SuperAdminController } from "./super-admin.controller";
import { SuperAdminService } from "./super-admin.service";
import { SuperAdminAccessKeyGuard } from "./super-admin.guard";

@Module({
  controllers: [SuperAdminController],
  providers: [SuperAdminService, SuperAdminAccessKeyGuard],
})
export class SuperAdminModule {}

