import { Controller, Post, Get, Body, Res, Req, HttpCode, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { IsEmail, IsString } from 'class-validator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user.type';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function setCookies(res: Response, csrfToken: string, refreshToken: string) {
  // Refresh token — HttpOnly, não acessível por JS
  res.cookie('haccp_refresh', refreshToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/',
  });

  // CSRF token — legível por JS para double-submit pattern
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/',
  });
}

function clearCookies(res: Response) {
  res.clearCookie('haccp_refresh', { path: '/' });
  res.clearCookie('csrf_token', { path: '/' });
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { access_token, refresh_token, user } = await this.authService.login(dto.email, dto.password);
    const csrfToken = randomBytes(32).toString('hex');
    setCookies(res, csrfToken, refresh_token);
    // Access token vai apenas no corpo — o frontend guarda em memória (Zustand)
    return { access_token, user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.['haccp_refresh'] as string | undefined;
    if (!rawRefreshToken) throw new Error('Refresh token ausente');

    const { access_token, refresh_token, user } = await this.authService.refresh(rawRefreshToken);
    const csrfToken = randomBytes(32).toString('hex');
    setCookies(res, csrfToken, refresh_token);
    return { access_token, user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.['haccp_refresh'] as string | undefined;
    await this.authService.logout(rawRefreshToken);
    clearCookies(res);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    const { ...safe } = user as any;
    delete safe.password;
    return safe;
  }
}
