import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ChallengGameMode, ChallengeStatus, DisputeReason } from "@fireslot/db";
import { ChallengesService, CreateChallengeDto } from "./challenges.service";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import {
  PermissionsGuard,
  RequirePermission,
} from "../../common/guards/permissions.guard";
import {
  FeatureFlagGuard,
  UseFeatureFlag,
} from "../../common/guards/feature-flag.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@Controller("challenges")
export class ChallengesController {
  constructor(private readonly svc: ChallengesService) {}

  @Get()
  list(
    @Query("gameMode") gameMode?: ChallengGameMode,
    @Query("status") status?: ChallengeStatus,
    @Query("limit") limit?: string,
  ) {
    return this.svc.list({
      gameMode,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("invite/:code")
  byInvite(@Param("code") code: string) {
    return this.svc.getByInviteCode(code);
  }

  @UseGuards(JwtAuthGuard)
  @Get("my")
  mine(@CurrentUser() u: any) {
    return this.svc.myChallenges(u.sub);
  }

  @Get(":id")
  one(@Param("id") id: string) {
    return this.svc.getById(id);
  }

  @UseGuards(JwtAuthGuard, FeatureFlagGuard)
  @UseFeatureFlag("CHALLENGE_CREATE_ENABLED")
  @Post()
  create(@CurrentUser() u: any, @Body() dto: CreateChallengeDto) {
    return this.svc.createChallenge(u.sub, dto);
  }

  @UseGuards(JwtAuthGuard, FeatureFlagGuard)
  @UseFeatureFlag("CHALLENGE_ENABLED")
  @Post(":id/join")
  join(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() body: { inviteCode?: string },
  ) {
    return this.svc.joinChallenge(u.sub, id, body?.inviteCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/room")
  room(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() body: { roomId: string; password: string },
  ) {
    return this.svc.shareRoom(id, u.sub, u.role, body.roomId, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/result")
  result(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body()
    body: {
      kills?: number;
      headshots?: number;
      damage?: number;
      survivalTimeSecs?: number;
      gotBooyah?: boolean;
      screenshotUrl?: string;
      povUrl?: string;
    },
  ) {
    return this.svc.submitResult(id, u.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/dispute")
  dispute(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body()
    body: { reason: DisputeReason; description: string; evidenceUrls: string[] },
  ) {
    return this.svc.raiseDispute(
      id,
      u.sub,
      body.reason,
      body.description,
      body.evidenceUrls ?? [],
    );
  }

  @Get("config/result-delay")
  resultDelay() {
    return this.svc.getResultSubmitDelay().then((mins) => ({ resultSubmitDelayMins: mins }));
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/check-timeout")
  checkTimeout(@Param("id") id: string) {
    return this.svc.handleRoomTimeout(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  cancel(@CurrentUser() u: any, @Param("id") id: string) {
    return this.svc.cancelChallenge(id, u.sub);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/challenges")
export class AdminChallengesController {
  constructor(private readonly svc: ChallengesService) {}

  @RequirePermission("tournaments", "read")
  @Get()
  list(
    @Query("status") status?: ChallengeStatus,
    @Query("gameMode") gameMode?: ChallengGameMode,
    @Query("limit") limit?: string,
  ) {
    return this.svc.listAdmin({
      status,
      gameMode,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @RequirePermission("support", "read")
  @Get("disputes")
  disputes() {
    return this.svc.listDisputes();
  }

  @RequirePermission("tournaments", "read")
  @Get("stats")
  stats() {
    return this.svc.getStats();
  }

  @RequirePermission("tournaments", "write")
  @Post(":id/room")
  shareRoom(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() body: { roomId: string; password: string },
  ) {
    return this.svc.shareRoom(id, u.sub, "ADMIN", body.roomId, body.password);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/disputes")
export class AdminDisputesController {
  constructor(private readonly svc: ChallengesService) {}

  @RequirePermission("support", "read")
  @Get(":id")
  detail(@Param("id") id: string) {
    return this.svc.getDisputeDetail(id);
  }

  @RequirePermission("support", "read")
  @Get(":id/notes")
  notes(@Param("id") id: string) {
    return this.svc.getDisputeNotes(id);
  }

  @RequirePermission("support", "write")
  @Post(":id/notes")
  addNote(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() body: { message: string },
  ) {
    return this.svc.addDisputeNote(id, u.sub, "SUPPORT", body.message);
  }

  @RequirePermission("support", "approve")
  @Put(":id/resolve")
  resolve(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body()
    body: { resolution: "CREATOR" | "OPPONENT" | "REFUND"; note?: string },
  ) {
    return this.svc.resolveDispute(id, u.sub, body.resolution, body.note);
  }
}

// Players can also add notes to their own disputes
@UseGuards(JwtAuthGuard)
@Controller("challenges")
export class ChallengeDisputeNotesController {
  constructor(private readonly svc: ChallengesService) {}

  @Post(":id/dispute/notes")
  async addNote(
    @CurrentUser() u: any,
    @Param("id") challengeId: string,
    @Body() body: { message: string },
  ) {
    const c = await this.svc.getById(challengeId);
    if (c.creatorId !== u.sub && c.opponentId !== u.sub) {
      throw new ForbiddenException("Not part of this challenge");
    }
    if (!c.disputeId) throw new BadRequestException("No dispute on this challenge");
    return this.svc.addDisputeNote(c.disputeId, u.sub, "PLAYER", body.message);
  }

  @Get(":id/dispute/notes")
  async getNotes(
    @CurrentUser() u: any,
    @Param("id") challengeId: string,
  ) {
    const c = await this.svc.getById(challengeId);
    if (c.creatorId !== u.sub && c.opponentId !== u.sub) {
      throw new ForbiddenException("Not part of this challenge");
    }
    if (!c.disputeId) return [];
    return this.svc.getDisputeNotes(c.disputeId);
  }
}
