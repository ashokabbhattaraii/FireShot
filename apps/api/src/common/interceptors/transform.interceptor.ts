import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { randomUUID } from "crypto";
import type { Request, Response } from "express";

/**
 * Wraps every successful response in a standard envelope and attaches
 * X-Request-ID + X-Response-Time headers.
 *
 * 304 responses (e.g. ETag matches) are passed through untouched.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const requestId =
      (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
    res.setHeader("X-Request-ID", requestId);
    (req as any).requestId = requestId;

    const start = Date.now();

    return next.handle().pipe(
      map((data) => {
        const responseTime = Date.now() - start;
        res.setHeader("X-Response-Time", `${responseTime}ms`);

        if (res.statusCode === 304 || data === undefined) return data;

        return {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
            responseTime,
          },
        };
      }),
    );
  }
}
