import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { jwtSecret } from "../../modules/auth/jwt-secret";
import { PrismaClient } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers["authorization"];
    if (!auth || !auth.startsWith("Bearer "))
      throw new UnauthorizedException("Missing token");
    try {
      const payload = await this.jwt.verifyAsync(auth.slice(7), {
        secret: jwtSecret(),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { isBanned: true, isLocked: true, sessionVersion: true, role: true },
      });
      if (!user || user.isBanned || user.isLocked) {
        throw new UnauthorizedException("Account unavailable");
      }
      if ((payload.sessionVersion ?? 0) !== user.sessionVersion) {
        throw new UnauthorizedException("Session expired");
      }
      payload.role = user.role;
      req.user = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid token");
    }
  }
}
