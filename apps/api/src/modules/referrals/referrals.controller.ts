import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import {
  PermissionsGuard,
  RequirePermission,
} from "../../common/guards/permissions.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ReferralsService } from "./referrals.service";
import { SystemConfigService } from "../admin/system-config.service";
import { RolesService } from "../admin/roles.service";

@UseGuards(JwtAuthGuard)
@Controller("referrals")
export class ReferralsController {
  constructor(private referrals: ReferralsService) {}

  @Get("me")
  mine(@CurrentUser() u: any) {
    return this.referrals.myReferral(u.sub);
  }

  @Put("claim")
  claim(
    @CurrentUser() u: any,
    @Body() body: { code?: string },
  ) {
    return this.referrals.claimSignupReferral(u.sub, body?.code);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/referrals")
export class AdminReferralsController {
  constructor(
    private referrals: ReferralsService,
    private config: SystemConfigService,
    private roles: RolesService,
  ) {}

  @RequirePermission("referrals", "read")
  @Get()
  summary() {
    return this.referrals.adminSummary();
  }

  @RequirePermission("referrals", "write")
  @Put("settings")
  async settings(
    @Body()
    body: {
      enabled: boolean;
      signupRewardNpr: number;
      referrerDepositRewardNpr: number;
    },
    @CurrentUser() u: any,
    @Req() req: any,
  ) {
    const canWriteReferrals = await this.roles.hasPermission(
      u.sub,
      "referrals",
      "write",
    );
    const canWriteConfig = await this.roles.hasPermission(u.sub, "config", "write");
    if (!canWriteReferrals && !canWriteConfig) {
      throw new ForbiddenException("Missing permission to update referral settings");
    }

    const signupRewardNpr = Number(body.signupRewardNpr ?? 0);
    const referrerDepositRewardNpr = Number(body.referrerDepositRewardNpr ?? 0);
    if (!Number.isFinite(signupRewardNpr) || signupRewardNpr < 0) {
      throw new BadRequestException("Signup reward must be a valid non-negative number");
    }
    if (
      !Number.isFinite(referrerDepositRewardNpr) ||
      referrerDepositRewardNpr < 0
    ) {
      throw new BadRequestException(
        "Referrer first deposit reward must be a valid non-negative number",
      );
    }

    const normalizedEnabled =
      body.enabled === true || String(body.enabled).toLowerCase() === "true";

    const updates = [
      { key: "REFERRAL_ENABLED", value: String(normalizedEnabled) },
      {
        key: "REFERRAL_SIGNUP_REWARD_NPR",
        value: String(Math.floor(signupRewardNpr)),
      },
      {
        key: "REFERRAL_FIRST_DEPOSIT_REWARD_NPR",
        value: String(Math.floor(referrerDepositRewardNpr)),
      },
    ];
    await this.config.bulkSet(updates, u.sub, req.ip);
    await this.config.refresh();
    return this.referrals.adminSummary();
  }
}
