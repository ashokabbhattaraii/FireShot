import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { AdminModule } from "../admin/admin.module";
import { AdminBannersController, PublicBannersController } from "./banners.controller";
import { BannersService } from "./banners.service";

@Module({
  imports: [AdminModule, MulterModule.register({ storage: memoryStorage() })],
  controllers: [PublicBannersController, AdminBannersController],
  providers: [BannersService],
})
export class BannersModule {}
