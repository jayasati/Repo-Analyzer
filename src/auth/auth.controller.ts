import {
  Body, Controller, Delete, Get,
  HttpCode, HttpStatus, Param, Post, Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto }  from './dto/register.dto';
import { LoginDto }     from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:  AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive a JWT' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  me(@Request() req: { user: { id: string; email: string; role: string } }) {
    return { id: req.user.id, email: req.user.email, role: req.user.role };
  }

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a new API key' })
  generateKey(
    @Request() req: { user: { id: string } },
    @Body() body: { name?: string },
  ) {
    return this.usersService.generateApiKey(req.user.id, body.name);
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all API keys' })
  listKeys(@Request() req: { user: { id: string } }) {
    return this.usersService.listApiKeys(req.user.id);
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke an API key' })
  revokeKey(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.usersService.revokeApiKey(id, req.user.id);
  }
}