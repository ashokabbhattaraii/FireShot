import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { Roles, RolesGuard } from "../../common/guards/roles.guard";
import { SuperAdminService } from "./super-admin.service";
import { SuperAdminAccessKeyGuard } from "./super-admin.guard";

@Controller("super-admin")
@UseGuards(JwtAuthGuard, RolesGuard, SuperAdminAccessKeyGuard)
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

  @Get("users")
  listAllUsers(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.svc.listAllUsers(+(page || 1), Math.min(+(limit || 50), 200));
  }

  @Get("users/:id/full")
  getUserFull(@Param("id") id: string) {
    return this.svc.getUserFull(id);
  }

  @Get("export/:table")
  async exportTable(@Param("table") table: string, @Res() res: Response) {
    try {
      const data = await this.svc.exportTable(table);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${table}-${Date.now()}.json"`);
      res.send(JSON.stringify(data, null, 2));
    } catch (e: any) {
      res.status(500).json({ message: e.message ?? "Export failed" });
    }
  }

  @Get("backup")
  async backupAll(@Res() res: Response) {
    try {
      const data = await this.svc.exportAllTables();
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="db-backup-${Date.now()}.json"`);
      res.send(JSON.stringify(data, null, 2));
    } catch (e: any) {
      res.status(500).json({ message: e.message ?? "Backup failed" });
    }
  }

  @Post("restore")
  restore(@Body() body: any) {
    return this.svc.restoreBackup(body);
  }
}
