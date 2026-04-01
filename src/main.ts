import './env'; 
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { AppLoggerService } from './common/logger/app-logger.service';
import 'dotenv/config';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

//-------------------------CORS--------------------------------------//
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map(o => o.trim());

  const corsOptions: CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  app.enableCors(corsOptions);

//------------------------------------------------------------------------//
  app.useGlobalPipes(new ValidationPipe({
    whitelist:            true,
    forbidNonWhitelisted: true,
    transform:            true,
  }));

  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(new CorrelationIdInterceptor(logger));
//-------------------------------------------------------------------------//
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
