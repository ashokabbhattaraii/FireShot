import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { RealtimeModule } from "../../common/realtime/realtime.module";
import {
  AdminReferralsController,
  ReferralsController,
} from "./referrals.controller";
import { ReferralsService } from "./referrals.service";

@Module({
  imports: [AdminModule, RealtimeModule],
  controllers: [ReferralsController, AdminReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
