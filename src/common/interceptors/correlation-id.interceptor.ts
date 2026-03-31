import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logger/app-logger.service';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req  = ctx.switchToHttp().getRequest<Request>();
    const resp = ctx.switchToHttp().getResponse<Response>();

    const id = (req.headers['x-correlation-id'] as string) ?? randomUUID();
    resp.setHeader('x-correlation-id', id);
    this.logger.setCorrelationId(id);

    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `${req.method} ${req.url} completed in ${Date.now() - start}ms`,
          'HTTP',
        );
      }),
    );
  }
}