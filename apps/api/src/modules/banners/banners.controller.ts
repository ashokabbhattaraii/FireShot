import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { PermissionsGuard, RequirePermission } from "../../common/guards/permissions.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { BannerDto, BannersService } from "./banners.service";

@Controller("banners")
export class PublicBannersController {
  constructor(private svc: BannersService) {}

  @Get()
  @Header("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
  getActive() {
    return this.svc.getActiveBanners();
  }

  @Get('splash')
  @Header("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
  async getSplash() {
    const items = await this.svc.getActiveBanners();
    const splash = items.find((b) => b.isSplash) || null;
    return splash;
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/banners")
export class AdminBannersController {
  constructor(private svc: BannersService) {}

  @RequirePermission("config", "write")
  @Get()
  getAll() {
    return this.svc.getAll();
  }

  @RequirePermission("config", "write")
  @Post()
  create(@Body() body: BannerDto, @CurrentUser() user: any, @Req() req: any) {
    return this.svc.create(body, user.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Put("reorder")
  reorder(
    @Body() body: { orders: { id: string; sortOrder: number }[] },
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    if (!Array.isArray(body.orders)) throw new BadRequestException("orders must be an array");
    return this.svc.reorder(body.orders, user.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Put(":id/toggle")
  toggle(@Param("id") id: string, @CurrentUser() user: any, @Req() req: any) {
    return this.svc.toggle(id, user.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Put(":id")
  update(@Param("id") id: string, @Body() body: BannerDto, @CurrentUser() user: any, @Req() req: any) {
    return this.svc.update(id, body, user.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: any, @Req() req: any) {
    return this.svc.remove(id, user.sub, req.ip);
  }

  @RequirePermission("config", "write")
  @Post(":id/upload")
  @UseInterceptors(FileInterceptor("image", { limits: { fileSize: 2 * 1024 * 1024 } }))
  upload(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query("variant") variant: "desktop" | "mobile" | undefined,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.svc.uploadImage(id, file, user.sub, req.ip, variant === "mobile" ? "mobile" : "desktop");
  }
}
