import { Module } from "@nestjs/common";
import { TournamentsController } from "./tournaments.controller";
import { TournamentsService } from "./tournaments.service";
import { PrizeService } from "./prize.service";
import { AdminModule } from "../admin/admin.module";
import { ProfileModule } from "../profile/profile.module";

@Module({
  imports: [AdminModule, ProfileModule],
  controllers: [TournamentsController],
  providers: [TournamentsService, PrizeService],
  exports: [PrizeService],
})
export class TournamentsModule {}
