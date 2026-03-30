import { Injectable, LoggerService, Scope } from '@nestjs/common';

/**
 * Structured JSON logger.
 *
 * WHY: console.log is scattered across 12+ files. A single service means
 * we can swap the transport (stdout / Winston / DataDog) in one place,
 * and every log line gets a correlationId for distributed tracing.
 */
@Injectable({ scope: Scope.DEFAULT })
export class AppLoggerService implements LoggerService {
  private correlationId: string | undefined;

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

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
    if (process.env.NODE_ENV === 'production') return;
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
    const entry: Record<string, unknown> = {
      timestamp:     new Date().toISOString(),
      level,
      message,
      ...(context       && { context }),
      ...(trace         && { trace }),
      ...(this.correlationId && { correlationId: this.correlationId }),
    };
    // In production pipe this to a proper transport (Winston / Pino).
    // For Phase 1, structured stdout is enough for log aggregators.
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}