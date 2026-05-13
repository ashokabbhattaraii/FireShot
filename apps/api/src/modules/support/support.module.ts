import { Module } from "@nestjs/common";
import { SupportPlayerController, SupportAdminController } from "./support.controller";
import { SupportService } from "./support.service";
import { AdminModule } from "../admin/admin.module";

@Module({
  imports: [AdminModule],
  controllers: [SupportPlayerController, SupportAdminController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
