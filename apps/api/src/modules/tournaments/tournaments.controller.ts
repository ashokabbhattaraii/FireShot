import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { TournamentsService } from "./tournaments.service";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { Roles, RolesGuard } from "../../common/guards/roles.guard";
import {
  PermissionsGuard,
  RequirePermission,
} from "../../common/guards/permissions.guard";
import {
  FeatureFlagGuard,
  UseFeatureFlag,
} from "../../common/guards/feature-flag.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  CreateTournamentDto,
  JoinTournamentDto,
  PublishRoomDto,
  UpdateTournamentStatusDto,
} from "./dto";
import { GameMode, Role, TournamentStatus, TournamentType } from "@fireslot/db";

@Controller("tournaments")
export class TournamentsController {
  constructor(private readonly svc: TournamentsService) {}

  @Get()
  list(
    @Query("mode") mode?: GameMode,
    @Query("status") status?: TournamentStatus,
    @Query("type") type?: TournamentType,
    @Query("minFee") minFee?: string,
    @Query("maxFee") maxFee?: string,
    @Query("limit") limit?: string,
  ) {
    return this.svc.list({
      mode,
      status,
      type,
      minFee: minFee ? parseInt(minFee, 10) : undefined,
      maxFee: maxFee ? parseInt(maxFee, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("free-daily/eligibility")
  freeDailyEligibility(@CurrentUser() u: any) {
    return this.svc.checkFreeDailyEligibility(u.sub);
  }

  @Get(":id")
  async getPublic(@Param("id") id: string) {
    return this.svc.getOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/full")
  async getFull(@Param("id") id: string, @CurrentUser() u: any) {
    return this.svc.getOne(id, u.sub, u.role);
  }

  /**
   * Hot-path endpoint: clients poll/refresh this on tournament detail.
   * Returns 304 when their ETag matches — zero body transfer under spike.
   */
  @UseGuards(JwtAuthGuard)
  @Get(":id/room")
  async room(
    @Param("id") id: string,
    @CurrentUser() u: any,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const details = await this.svc.getRoomDetails(id, u.sub, u.role);
    res.setHeader("Cache-Control", "private, max-age=10");
    res.setHeader("ETag", `"${details.etag}"`);
    if (ifNoneMatch && ifNoneMatch.replace(/"/g, "") === details.etag) {
      res.status(304);
      return;
    }
    return details;
  }

  @UseGuards(JwtAuthGuard, FeatureFlagGuard)
  @UseFeatureFlag("TOURNAMENT_JOIN_ENABLED")
  @Post(":id/join")
  join(@Param("id") id: string, @CurrentUser() u: any, @Body() dto: JoinTournamentDto) {
    return this.svc.join(u.sub, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/eligibility")
  eligibility(@Param("id") id: string, @CurrentUser() u: any) {
    return this.svc.checkEligibility(u.sub, id);
  }

  @Get("preview/pricing")
  previewPricing(@Query("entryFee") entryFee: string, @Query("maxPlayers") maxPlayers: string) {
    return this.svc.previewPricing(parseInt(entryFee, 10), parseInt(maxPlayers, 10));
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN)
  @RequirePermission("tournaments", "write")
  @Post(":id/lock-room")
  lockRoom(@Param("id") id: string) {
    return this.svc.lockRoom(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me/joined")
  mine(@CurrentUser() u: any) {
    return this.svc.myTournaments(u.sub);
  }

  // ----- Admin -----
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, FeatureFlagGuard)
  @Roles(Role.ADMIN)
  @RequirePermission("tournaments", "write")
  @UseFeatureFlag("TOURNAMENT_CREATE_ENABLED")
  @Post()
  create(@CurrentUser() u: any, @Body() dto: CreateTournamentDto) {
    return this.svc.create(u.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN)
  @RequirePermission("tournaments", "write")
  @Put(":id/status")
  status(@Param("id") id: string, @Body() dto: UpdateTournamentStatusDto) {
    return this.svc.setStatus(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN)
  @RequirePermission("tournaments", "write")
  @Put(":id/room")
  publishRoom(@Param("id") id: string, @Body() dto: PublishRoomDto) {
    return this.svc.publishRoom(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN)
  @RequirePermission("tournaments", "write")
  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.svc.delete(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN)
  @RequirePermission("tournaments", "approve")
  @Post(":id/winners")
  winners(
    @Param("id") id: string,
    @Body()
    body: {
      winners: {
        userId: string;
        placement?: number;
        kills?: number;
        gotBooyah?: boolean;
      }[];
    },
  ) {
    return this.svc.declareWinners(id, body.winners);
  }
}
