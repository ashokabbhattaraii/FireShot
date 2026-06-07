import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { Roles, RolesGuard } from "../../common/guards/roles.guard";

@Controller("categories")
export class CategoriesController {
  constructor(private svc: CategoriesService) {}

  @Get()
  list() {
    return this.svc.getActiveCategories();
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  update(@Param("id") id: string, @Body() body: { thumbnailUrl?: string; coverUrl?: string }) {
    return this.svc.updateCategory(id, body);
  }
}
