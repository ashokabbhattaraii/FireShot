import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesService } from "../../modules/admin/roles.service";

export const PERMISSION_KEY = "permission";
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { resource, action });

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private roles: RolesService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<{
      resource: string;
      action: string;
    }>(PERMISSION_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required) return true;
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.sub) throw new ForbiddenException("Not authenticated");
    const ok = await this.roles.hasPermission(req.user.sub, required.resource, required.action);
    if (!ok) throw new ForbiddenException(`Missing permission: ${required.resource}:${required.action}`);
    return true;
  }
}
