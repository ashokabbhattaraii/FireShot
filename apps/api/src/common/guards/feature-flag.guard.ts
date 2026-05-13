import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FeatureFlagService } from "../../modules/admin/feature-flag.service";

export const FEATURE_FLAG_KEY = "featureFlag";
export const UseFeatureFlag = (key: string) =>
  SetMetadata(FEATURE_FLAG_KEY, key);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private flags: FeatureFlagService,
    private reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const key = this.reflector.get<string>(
      FEATURE_FLAG_KEY,
      ctx.getHandler(),
    );
    if (!key) return true;
    if (!this.flags.isEnabled(key)) {
      throw new HttpException(
        { message: "This feature is temporarily disabled.", feature: key },
        503,
      );
    }
    return true;
  }
}
