import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const SKIP_PATHS = new Set(["/health", "/health/live", "/health/ready"]);
const LOG_HTTP_REQUESTS =
  process.env.HTTP_LOGS === "true" || process.env.NODE_ENV !== "production";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction) {
    if (!LOG_HTTP_REQUESTS || SKIP_PATHS.has(req.path)) return next();

    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      const userId = (req as any).user?.sub ?? null;
      const requestId = (req as any).requestId ?? res.getHeader("X-Request-ID") ?? null;
      const ip = req.ip ?? req.socket.remoteAddress ?? null;
      // JSON line for log aggregators
      this.logger.log(
        JSON.stringify({
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          ms,
          userId,
          ip,
          requestId,
        }),
      );
    });

    next();
  }
}
