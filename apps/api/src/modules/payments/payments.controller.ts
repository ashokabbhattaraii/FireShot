import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { PaymentsService } from "./payments.service";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { Roles, RolesGuard } from "../../common/guards/roles.guard";
import {
  FeatureFlagGuard,
  UseFeatureFlag,
} from "../../common/guards/feature-flag.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { StorageService } from "../../common/storage/storage.service";
import { PaymentStatus, Role } from "@fireslot/db";

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly svc: PaymentsService,
    private readonly storage: StorageService,
  ) {}

  @UseGuards(JwtAuthGuard, FeatureFlagGuard)
  @UseFeatureFlag("PAYMENT_PROOF_ENABLED")
  @Post()
  @UseInterceptors(FileInterceptor("proof"))
  async submit(
    @CurrentUser() u: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    const url = file ? (await this.storage.upload(file, "payments", "proof")).url : "";
    return this.svc.submit(u.sub, body, url);
  }

  @UseGuards(JwtAuthGuard, FeatureFlagGuard)
  @UseFeatureFlag("DEPOSIT_ENABLED")
  @Post("deposit")
  @UseInterceptors(FileInterceptor("proof"))
  async deposit(
    @CurrentUser() u: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    const url = file ? (await this.storage.upload(file, "deposits", "proof")).url : "";
    return this.svc.deposit(u.sub, body, url);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  mine(@CurrentUser() u: any) {
    return this.svc.myPayments(u.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.FINANCE, Role.SUPER_ADMIN)
  @Get()
  list(@Query("status") status?: PaymentStatus) {
    return this.svc.list(status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.FINANCE, Role.SUPER_ADMIN)
  @Post(":id/approve")
  approve(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() body: { reviewNote?: string },
  ) {
    return this.svc.approve(u.sub, id, body?.reviewNote);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.FINANCE, Role.SUPER_ADMIN)
  @Post(":id/reject")
  reject(
    @CurrentUser() u: any,
    @Param("id") id: string,
    @Body() body: { note?: string; reason?: string },
  ) {
    return this.svc.reject(u.sub, id, body?.reason ?? body?.note);
  }
}
