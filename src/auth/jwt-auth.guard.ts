import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protects routes — returns 401 if no valid JWT or API key.
 * Use @UseGuards(JwtAuthGuard) on controllers/routes.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt', 'api-key']) {}