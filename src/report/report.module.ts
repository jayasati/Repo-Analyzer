import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportService } from './report.service';
import { ShareService } from './share.service';
import { ShareController } from './share.controller';
import { SharedReportEntity } from '../persistence/entities/shared-report.entity';
import { CacheModule } from '../cache/cache.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SharedReportEntity]),
    CacheModule,
    AuthModule,
  ],
  providers: [ReportService, ShareService],
  controllers: [ShareController],
  exports: [ReportService, ShareService],
})
export class ReportModule {}
