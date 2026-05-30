import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, url, body, ip } = req;
    const start = Date.now();

    const safeBody = this.sanitizeBody(body);
    this.logger.log(`→ ${method} ${url} | ip=${ip} | body=${JSON.stringify(safeBody)}`);

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(`← ${method} ${url} ${res.statusCode} +${ms}ms`);
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - start;
        this.logger.error(
          `← ${method} ${url} ERROR +${ms}ms — ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
        return throwError(() => err);
      }),
    );
  }

  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    if (!body || typeof body !== 'object') return body;
    const redacted = { ...body };
    for (const key of ['password', 'passwordHash', 'refreshToken', 'accessToken', 'secret']) {
      if (key in redacted) redacted[key] = '[REDACTED]';
    }
    return redacted;
  }
}
