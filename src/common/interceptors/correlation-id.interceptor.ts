import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { AppLoggerService } from '../logger/app-logger.service';

/**
 * Attaches a correlation ID to every request/response pair.
 *
 * WHY: Without this, logs from concurrent requests interleave with no
 * way to reconstruct what happened during a single analysis run.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req  = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const resp = ctx.switchToHttp().getResponse<{ setHeader(k: string, v: string): void }>();

    const id = req.headers['x-correlation-id'] ?? randomUUID();
    resp.setHeader('x-correlation-id', id);
    this.logger.setCorrelationId(id);

    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `${req['method']} ${req['url']} completed in ${Date.now() - start}ms`,
          'HTTP',
        );
      }),
    );
  }
}