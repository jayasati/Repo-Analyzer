import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AppLoggerService } from '../logger/app-logger.service';

/**
 * Logs every incoming request with method, path, status, and duration.
 * This is the single source of truth for HTTP access logs — no more
 * scattered logger.log() calls across controllers.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx
      .switchToHttp()
      .getRequest<{ method: string; url: string }>();
    const start = Date.now();
    const label = `${req.method} ${req.url}`;

    this.logger.log(`→ ${label}`, 'HTTP');

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`← ${label} ${Date.now() - start}ms`, 'HTTP');
      }),
      catchError((err) => {
        this.logger.error(
          `✗ ${label} ${Date.now() - start}ms`,
          err instanceof Error ? err.stack : String(err),
          'HTTP',
        );
        return throwError(() => err);
      }),
    );
  }
}
