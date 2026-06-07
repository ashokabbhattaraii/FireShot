import { Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { Roles, RolesGuard } from "../../common/guards/roles.guard";
import { SuperAdminService } from "./super-admin.service";

@Controller("super-admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN")
export class SuperAdminController {
  constructor(private svc: SuperAdminService) {}

  @Get("tables")
  listTables() {
    return this.svc.listTables();
  }

  @Get("tables/:table")
  browseTable(
    @Param("table") table: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.svc.browseTable(table, +(page || 1), Math.min(+(limit || 50), 200));
  }

  @Get("users/:id/full")
  getUserFull(@Param("id") id: string) {
    return this.svc.getUserFull(id);
  }

  @Get("export/:table")
  async exportTable(@Param("table") table: string, @Res() res: Response) {
    const data = await this.svc.exportTable(table);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${table}-${Date.now()}.json"`);
    res.send(JSON.stringify(data, null, 2));
  }

  @Get("backup")
  async backupAll(@Res() res: Response) {
    const data = await this.svc.exportAllTables();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="db-backup-${Date.now()}.json"`);
    res.send(JSON.stringify(data, null, 2));
  }
}
