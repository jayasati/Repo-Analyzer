import './env'; 
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { AppLoggerService } from './common/logger/app-logger.service';
import 'dotenv/config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map(o => o.trim());

  app.enableCors({
    origin:      allowedOrigins,
    methods:     ['GET', 'POST'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist:            true,
    forbidNonWhitelisted: true,
    transform:            true,
  }));

  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(new CorrelationIdInterceptor(logger));

  const config = new DocumentBuilder()
    .setTitle('Repo Analyzer API')
    .setDescription('Architecture analysis for GitHub repositories')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`Application running on port ${process.env.PORT ?? 3000}`, 'Bootstrap');
}

bootstrap();
