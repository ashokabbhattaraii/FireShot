import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { PrismaClient, Role } from "@fireslot/db";
import { PRISMA } from "../../prisma/prisma.module";
import { GoogleLoginDto, LoginDto, RegisterDto } from "./dto";
import { jwtSecret } from "./jwt-secret";
import { ReferralsService } from "../referrals/referrals.service";

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client | null = null;

  constructor(
    @Inject(PRISMA) private prisma: PrismaClient,
    private jwt: JwtService,
    private referrals: ReferralsService,
  ) {}

  private getGoogleClient(): OAuth2Client {
    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(this.googleClientId);
    }
    return this.googleClient;
  }

  async register(dto: RegisterDto) {
    this.assertReady();
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException("Email already registered");
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        phone: dto.phone?.trim() || undefined,
        passwordHash,
        wallet: { create: {} },
      },
    });
    return this.issueToken(user.id, user.email, user.role, {
      name: user.name,
      avatarUrl: user.avatarUrl,
    });
  }

  async login(dto: LoginDto) {
    this.assertReady();
    if (!dto?.email || !dto?.password)
      throw new UnauthorizedException("Invalid credentials");
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    if (user.isBanned) throw new UnauthorizedException("Account banned");
    if (user.isLocked) throw new UnauthorizedException("Account locked");
    if (!user.passwordHash) {
      throw new UnauthorizedException("This account uses Google sign-in");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    return this.issueToken(user.id, user.email, user.role, {
      name: user.name,
      avatarUrl: user.avatarUrl,
    });
  }

  async googleLogin(dto: GoogleLoginDto) {
    this.assertReady();
    const clientId = this.googleClientId;
    if (!clientId)
      throw new InternalServerErrorException("Google OAuth is not configured");
    if (!dto?.credential && !dto?.accessToken)
      throw new UnauthorizedException("Missing Google credential");

    let email: string | undefined;
    let googleId: string | undefined;
    let name: string | undefined;
    let picture: string | undefined;

    if (dto.credential) {
      // ID token flow (iframe button on web browser)
      let ticket;
      try {
        ticket = await this.getGoogleClient().verifyIdToken({
          idToken: dto.credential,
          audience: clientId,
        });
      } catch {
        throw new UnauthorizedException("Invalid or expired Google credential");
      }
      const payload = ticket.getPayload();
      email = payload?.email?.toLowerCase();
      googleId = payload?.sub;
      name = payload?.name;
      picture = payload?.picture;
      if (!email || !googleId || payload?.email_verified === false) {
        throw new UnauthorizedException("Google account could not be verified");
      }
    } else {
      // Access token flow (popup button — works in Capacitor WebView)
      let userInfo: any;
      try {
        const res = await fetch(
          `https://www.googleapis.com/oauth2/v3/userinfo`,
          { headers: { Authorization: `Bearer ${dto.accessToken}` } },
        );
        if (!res.ok) throw new Error(`Google userinfo ${res.status}`);
        userInfo = await res.json();
      } catch {
        throw new UnauthorizedException("Invalid or expired Google access token");
      }
      email = userInfo.email?.toLowerCase();
      googleId = userInfo.sub;
      name = userInfo.name;
      picture = userInfo.picture;
      if (!email || !googleId || userInfo.email_verified === false) {
        throw new UnauthorizedException("Google account could not be verified");
      }
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { googleId }] },
    });
    const referralCode = this.referrals.normalizeCode(dto.referralCode);
    if (!existing && referralCode) {
      await this.referrals.validateCodeForSignup(referralCode);
    }
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            email,
            googleId,
            name,
            avatarUrl: picture,
          },
        })
      : await this.prisma.user.create({
          data: {
            email,
            googleId,
            name,
            avatarUrl: picture,
            referralCode: await this.referrals.generateUniqueCode(),
            wallet: { create: {} },
          },
        });

    if (!existing && referralCode) {
      await this.referrals.attachSignupReferral(user.id, referralCode);
    }

    if (user.isBanned) throw new UnauthorizedException("Account banned");
    if (user.isLocked) throw new UnauthorizedException("Account locked");
    await this.prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    let role: Role = user.role;
    try {
      role = await this.ensureUserRole(
        user.id,
        user.email,
        user.role,
        user.roleId,
      );
    } catch {
      // Non-critical: role assignment failed, continue with existing role
    }

    const issued = await this.issueToken(user.id, user.email, role, {
      name: user.name,
      avatarUrl: user.avatarUrl,
    });
    return {
      ...issued,
      isNewUser: !existing,
      needsReferralOnboarding: !existing && !referralCode,
    };
  }

  private async ensureUserRole(
    userId: string,
    email: string,
    currentRole: Role,
    currentRoleId: string | null,
  ): Promise<Role> {
    const isSuperAdmin = email.toLowerCase() === "bhattaraiashok101@gmail.com";
    if (isSuperAdmin) {
      const su = await this.prisma.userRole.findUnique({ where: { name: "SUPER_ADMIN" } });
      if (su && (currentRoleId !== su.id || currentRole !== "SUPER_ADMIN")) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { roleId: su.id, role: "SUPER_ADMIN" },
        });
      }
      return "SUPER_ADMIN";
    }

    if (!currentRoleId) {
      const roleName = currentRole;
      const roleRef = await this.prisma.userRole.findUnique({ where: { name: roleName } });
      if (roleRef) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { roleId: roleRef.id, role: currentRole },
        });
      }
    }

    return currentRole;
  }

  async me(userId: string, tokenRole?: Role | string) {
    this.assertReady();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isBanned: true,
        isLocked: true,
        sessionVersion: true,
        createdAt: true,
        profile: true,
        wallet: true,
        roleRef: { select: { id: true, name: true } },
        referralCode: true,
      },
    });
    if (!user) return null;

    if (tokenRole && tokenRole !== user.role) {
      const issued = await this.issueToken(user.id, user.email, user.role, {
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
      return { ...user, token: issued.token };
    }

    return user;
  }

  private async issueToken(
    sub: string,
    email: string,
    role: Role | string,
    extra?: { name?: string | null; avatarUrl?: string | null },
  ) {
    const session = await this.prisma.user.findUnique({
      where: { id: sub },
      select: { sessionVersion: true },
    });
    const token = await this.jwt.signAsync(
      { sub, email, role, sessionVersion: session?.sessionVersion ?? 0 },
      { secret: jwtSecret() },
    );
    return { token, user: { id: sub, email, role, ...extra } };
  }

  private assertReady() {
    if (!this.prisma?.user) {
      throw new InternalServerErrorException(
        "Database client is not available",
      );
    }
  }

  private get googleClientId() {
    return (
      process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    );
  }
}
