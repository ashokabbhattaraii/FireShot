import { Module } from "@nestjs/common";
import {
  AdminChallengesController,
  AdminDisputesController,
  ChallengeDisputeNotesController,
  ChallengesController,
} from "./challenges.controller";
import { ChallengesService } from "./challenges.service";
import { AdminModule } from "../admin/admin.module";
import { ProfileModule } from "../profile/profile.module";

@Module({
  imports: [AdminModule, ProfileModule],
  controllers: [
    ChallengesController,
    ChallengeDisputeNotesController,
    AdminChallengesController,
    AdminDisputesController,
  ],
  providers: [ChallengesService],
})
export class ChallengesModule {}
