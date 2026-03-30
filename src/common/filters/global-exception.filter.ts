import {
  ArgumentsHost, Catch, ExceptionFilter,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logger/app-logger.service';

/**
 * WHY: Without a global filter, unhandled errors return raw Node stack
 * traces to the client, leaking internal file paths and dependency info.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx    = host.switchToHttp();
    const req    = ctx.getRequest<Request>();
    const res    = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as { message?: string }).message ??
          exception.message
        : 'Internal server error';

    // Log full stack only server-side, never send it to clients
    if (status >= 500) {
      this.logger.error(
        `Unhandled exception: ${String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
        'GlobalExceptionFilter',
      );
    }

    res.status(status).json({
      statusCode: status,
      message,
      path:       req.url,
      timestamp:  new Date().toISOString(),
    });
  }
}