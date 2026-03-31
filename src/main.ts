import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { AppLoggerService } from './common/logger/app-logger.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';


async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  // ── Security headers ─────────────────────────────────────────────────────
  // WHY wildcard CORS is dangerous: any page on the internet can call your
  // API from a visitor's browser, leaking your analysis results to them.
  // Lock down to your actual front-end origin(s).
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map(o => o.trim());

  app.enableCors({
    origin:      allowedOrigins,
    methods:     ['GET', 'POST'],
    credentials: true,
  });

  // ── Input validation ──────────────────────────────────────────────────────
  // WHY whitelist: any extra field in the body gets stripped — prevents
  // parameter pollution and future accidental exposure of internal fields.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
      transformOptions:     { enableImplicitConversion: true },
    }),
  );

  // ── Cross-cutting concerns ────────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(new CorrelationIdInterceptor(logger));

  // ── Analysis request timeout ──────────────────────────────────────────────
  // WHY: Without this, a pathological repo can hold the HTTP connection
  // open indefinitely, exhausting the thread pool.
  app.use((req: unknown, res: { setTimeout: (ms: number) => void }, next: () => void) => {
    (res as { setTimeout: (ms: number) => void }).setTimeout(
      Number(process.env.ANALYSIS_TIMEOUT_MS ?? 180_000),
    );
    next();
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const config = new DocumentBuilder()
  .setTitle('Repo Analyzer API')
  .setDescription('Architecture analysis for GitHub repositories')
  .setVersion('1.0')
  .addTag('analysis')
  .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  logger.log(`Application listening on port ${port}`, 'Bootstrap');
}

bootstrap();