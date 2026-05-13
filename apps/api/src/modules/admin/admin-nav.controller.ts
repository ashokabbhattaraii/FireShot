import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RolesService } from "./roles.service";

@UseGuards(JwtAuthGuard)
@Controller("admin/auth")
export class AdminNavController {
  constructor(private roles: RolesService) {}

  @Get("nav")
  async nav(@CurrentUser() u: any) {
    return this.getAdminNav(u.sub);
  }

  private async getAdminNav(userId: string): Promise<string[]> {
    const check = async (resource: string, action: string) =>
      this.roles.hasPermission(userId, resource, action);

    const nav: string[] = [];

    if (await check("*", "*")) {
      return [
        "overview", "tournaments", "payments", "results", "withdrawals",
        "reports", "risk-profiles",
        "users", "banners", "config", "schedule", "flags", "support", "referrals",
        "bot", "roles", "logs", "apk-releases", "apk-test",
      ];
    }

    if (await check("tournaments", "read")) nav.push("tournaments");
    if (await check("payments", "read")) nav.push("payments");
    if (await check("results", "read")) nav.push("results");
    if (await check("withdrawals", "read")) nav.push("withdrawals");
    if (await check("reports", "read")) nav.push("reports");
    if (await check("finance", "read") || await check("risk-profiles", "read")) nav.push("risk-profiles");
    if (await check("users", "read")) nav.push("users");
    if (await check("banners", "read")) nav.push("banners");
    if (await check("config", "read")) {
      nav.push("config", "schedule", "flags");
    }
    if (await check("support", "read")) nav.push("support");
    if (await check("referrals", "read")) nav.push("referrals");
    if (await check("bot", "read")) nav.push("bot");
    if (await check("roles", "read") || await check("config", "read")) nav.push("roles");
    if (await check("logs", "read")) nav.push("logs");
    if (await check("apk", "read")) nav.push("apk-releases", "apk-test");

    if (nav.length > 0) nav.push("overview");
    return [...new Set(nav)];
  }
}
