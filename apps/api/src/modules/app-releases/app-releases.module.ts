import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  AppReleasesController,
  PublicAppReleasesController,
} from "./app-releases.controller";
import { AppReleasesService } from "./app-releases.service";
import { AdminModule } from "../admin/admin.module";

@Module({
  imports: [
    AdminModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [AppReleasesController, PublicAppReleasesController],
  providers: [AppReleasesService],
})
export class AppReleasesModule {}
