import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { jwtSecret } from "./jwt-secret";
import { ReferralsModule } from "../referrals/referrals.module";

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecret(),
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" },
    }),
    ReferralsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
