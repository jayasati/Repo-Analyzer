import { Injectable, LoggerService, Scope } from '@nestjs/common';
import * as winston from 'winston';
import { APP_CONSTANTS } from '../constants/app.constants';

/**
 * WHY Winston over console:
 * 1. Log levels are environment-aware (debug only in dev)
 * 2. JSON format is machine-parseable by Datadog / CloudWatch / Loki
 * 3. Transports are configurable: stdout for dev, file+stdout for prod
 * 4. Performance: buffered writes, not synchronous console.log
 */
@Injectable({ scope: Scope.DEFAULT })
export class AppLoggerService implements LoggerService {
  private readonly winston: winston.Logger;
  private correlationId: string | undefined;

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';

    this.winston = winston.createLogger({
      level: isProd ? 'info' : 'debug',
      format: isProd
        ? winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          )
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ level, message, timestamp, context }) =>
              `${timestamp} [${context ?? 'App'}] ${level}: ${message}`,
            ),
          ),
      transports: [new winston.transports.Console()],
    });
  }

  setCorrelationId(id: string): void { this.correlationId = id; }

  log(message: string, context?: string): void {
    this.emit('info', message, context);
  }
  error(message: string, trace?: string, context?: string): void {
    this.emit('error', message, context, trace);
  }
  warn(message: string, context?: string): void {
    this.emit('warn', message, context);
  }
  debug(message: string, context?: string): void {
    this.emit('debug', message, context);
  }
  verbose(message: string, context?: string): void {
    this.emit('verbose', message, context);
  }

  private emit(
    level: string,
    message: string,
    context?: string,
    trace?: string,
  ): void {
    this.winston.log(level, message, {
      context,
      ...(trace             && { trace }),
      ...(this.correlationId && { correlationId: this.correlationId }),
    });
  }
}