import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../users/users.types';
import { ScanRepoDto } from './dto/scan-repo.dto';
import { ReposService } from './repos.service';

@ApiTags('repos')
@Controller('repos')
export class ReposController {
  constructor(private readonly repos: ReposService) {}

  @Post('scan')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Validate GitHub ownership and enqueue analysis (stub uses existing analysis worker)',
  })
  scan(@Request() req: { user: AuthUserPayload }, @Body() dto: ScanRepoDto) {
    return this.repos.queueScan(req.user.id, dto.repo);
  }
}
