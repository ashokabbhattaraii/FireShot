import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class SuperAdminAccessKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // Require both:
    // 1) SUPER_ADMIN role (enforced by RolesGuard at controller level)
    // 2) Correct access key sent by client

    const expected = process.env.TEST_KEY;
    if (!expected) {
      // If key isn't configured, block super-admin access to be safe.
      throw new ForbiddenException("Super admin access key not configured");
    }

    const headerKey = req.headers["x-super-admin-key"];
    const bodyKey = (req.body as any)?.accessKey;

    const headerProvided =
      typeof headerKey === "string" ? headerKey : undefined;
    const bodyProvided =
      typeof bodyKey === "string" ? bodyKey : undefined;
    const provided = headerProvided ?? bodyProvided;

    if (!provided || provided !== expected) {
      throw new ForbiddenException("Invalid super admin access key");
    }

    return true;
  }
}

