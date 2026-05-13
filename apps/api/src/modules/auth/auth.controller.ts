import {
  Body,
  Controller,
  Get,
  GoneException,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { GoogleLoginDto } from "./dto";
import { JwtAuthGuard } from "../../common/guards/jwt.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register() {
    throw new GoneException(
      "Email/password registration is disabled. Use Google sign-in.",
    );
  }

  @Post("login")
  login() {
    throw new GoneException(
      "Email/password login is disabled. Use Google sign-in.",
    );
  }

  @Post("google")
  google(@Body() dto: GoogleLoginDto) {
    return this.auth.googleLogin(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() u: any) {
    return this.auth.me(u.sub, u.role);
  }
}
