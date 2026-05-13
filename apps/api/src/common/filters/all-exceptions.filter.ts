import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Standardize error responses to match the success envelope used by
 * TransformInterceptor. Preserves status codes from HttpException.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal Server Error";
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      if (typeof r === "string") {
        message = r;
      } else if (typeof r === "object" && r !== null) {
        const obj = r as Record<string, unknown>;
        message = (obj.message as string | string[]) ?? exception.message;
        code = (obj.error as string | undefined) ?? code;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.stack ?? exception.message);
    }

    const requestId = (req as any).requestId;
    res.status(status).json({
      success: false,
      message,
      code: code ?? `HTTP_${status}`,
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        path: req.url,
      },
    });
  }
}
