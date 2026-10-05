import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CookieOptions, Request, Response } from 'express';
import { AuthService, SessionMeta } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendVerificationDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CsrfOriginGuard } from './guards/csrf-origin.guard';
import { env } from '../../config/env';

type AuthenticatedRequest = Request & { user: { userId: string; sessionId?: string } };

const REFRESH_COOKIE = 'wy_refresh';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente.' })
  @ApiResponse({ status: 409, description: 'El correo ya está registrado.' })
  @ApiResponse({ status: 429, description: 'Demasiadas solicitudes.' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verificar correo electrónico' })
  verifyEmail(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reenviar el correo de verificación' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso: access token en el cuerpo y refresh token en cookie httpOnly.' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas o cuenta bloqueada.' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(loginDto, this.sessionMeta(req));
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    return { accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfOriginGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Renovar el access token usando el refresh token (rotación)' })
  @ApiResponse({ status: 200, description: 'Nuevo access token y cookie de refresco rotada.' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o reutilizado.' })
  @ApiResponse({ status: 403, description: 'Origen no permitido.' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Solo la cookie. Aceptar el token en el cuerpo haría esta ruta alcanzable
    // desde cualquier web con una petición simple, sin que CORS la detenga.
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('No hay una sesión activa');
    }

    const tokens = await this.authService.refresh(refreshToken, this.sessionMeta(req));
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfOriginGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cerrar la sesión actual (revoca el refresh token)' })
  @ApiResponse({ status: 403, description: 'Origen no permitido.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.clearRefreshCookie(res);
    return this.authService.logout(req.cookies?.[REFRESH_COOKIE] ?? '');
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cerrar todas las sesiones del usuario autenticado' })
  async logoutAll(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearRefreshCookie(res);
    return this.authService.logoutAll(req.user.userId);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar las sesiones activas del usuario autenticado' })
  listSessions(@Req() req: AuthenticatedRequest) {
    return this.authService.listSessions(req.user.userId, req.user.sessionId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cerrar una sesión específica del usuario autenticado' })
  @ApiResponse({ status: 404, description: 'La sesión no existe o no pertenece al usuario.' })
  async revokeSession(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.revokeSession(
      req.user.userId,
      id,
      req.user.sessionId,
      this.sessionMeta(req),
    );

    if (id === req.user.sessionId) {
      this.clearRefreshCookie(res);
    }

    return result;
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cerrar todas las sesiones excepto la actual' })
  revokeOtherSessions(@Req() req: AuthenticatedRequest) {
    return this.authService.revokeOtherSessions(
      req.user.userId,
      req.user.sessionId,
      this.sessionMeta(req),
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Solicitar enlace de recuperación de contraseña por email' })
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Restablecer contraseña usando el token del email' })
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  private refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: env.cookie.secure,
      sameSite: env.cookie.sameSite,
      domain: env.cookie.domain || undefined,
      path: '/auth',
    };
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(REFRESH_COOKIE, token, { ...this.refreshCookieOptions(), expires: expiresAt });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
  }

  private sessionMeta(req: Request): SessionMeta {
    const userAgent = req.headers['user-agent'];
    return {
      ipAddress: req.ip ?? null,
      deviceInfo: Array.isArray(userAgent) ? userAgent.join(' ') : (userAgent ?? null),
    };
  }
}
