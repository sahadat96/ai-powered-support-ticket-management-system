import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from '../application/auth.service';
import { CurrentUser, Public, Roles } from './auth.decorators';
import { LoginDto, RegisterDto } from './auth.dto';
import { PublicUser } from '../../users/domain/user';
import { UserRepository } from '../../users/domain/user.repository';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly users: UserRepository,
  ) {}
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Register a customer account; staff roles cannot be self-assigned',
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto);
    this.setCookie(res, result.accessToken);
    return result;
  }
  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);
    this.setCookie(res, result.accessToken);
    return result;
  }
  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('support_session', {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/',
    });
    return { message: 'Signed out.' };
  }
  @ApiBearerAuth()
  @ApiCookieAuth()
  @Get('me')
  me(@CurrentUser() user: PublicUser) {
    return user;
  }
  @ApiBearerAuth()
  @ApiCookieAuth()
  @Roles('ADMIN', 'AGENT')
  @Get('staff')
  staff() {
    return this.users.listStaff();
  }
  private setCookie(res: Response, token: string) {
    res.cookie('support_session', token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: this.config.get<number>('JWT_EXPIRES_IN_SECONDS')! * 1000,
    });
  }
}
