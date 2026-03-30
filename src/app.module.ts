import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CoreModule }   from './core/core.module';
import { ApiModule }    from './api/api.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './common/logger/logger.module';
import { APP_CONSTANTS } from './common/constants/app.constants';

@Module({
  imports: [
    // WHY ThrottlerModule at the root: rate-limit storage is shared
    // across all controllers. With per-controller setup you'd need to
    // configure it separately in each module.
    ThrottlerModule.forRoot([{
      ttl:   APP_CONSTANTS.RATE_LIMIT_TTL_SECONDS * 1000,
      limit: APP_CONSTANTS.RATE_LIMIT_MAX_REQUESTS,
    }]),
    LoggerModule,
    HealthModule,
    CoreModule,
    ApiModule,
  ],
})
export class AppModule {}