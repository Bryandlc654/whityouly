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
  VerifyEmailCodeDto,
  MfaCodeDto,
  MfaVerifyLoginDto,
  MfaDisableDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CsrfOriginGuard } from './guards/csrf-origin.guard';
import { env } from '../../config/env';

type AuthenticatedRequest = Request & { user: { userId: string; sessionId?: string } };

const LEGACY_REFRESH_COOKIE = 'wy_refresh';
const SECURE_REFRESH_COOKIE = '__Secure-wy_refresh';

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

  @Post('verify-email-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verificar correo electrónico con el código de 6 dígitos' })
  verifyEmailCode(@Body() dto: VerifyEmailCodeDto) {
    return this.authService.verifyEmailCode(dto);
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
    const result = await this.authService.login(loginDto, this.sessionMeta(req));
    if ('mfaRequired' in result) {
      return result;
    }
    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
    return { accessToken: result.accessToken };
  }

  @Post('mfa/verify-login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Completar el inicio de sesión con el código MFA' })
  async verifyMfaLogin(
    @Body() dto: MfaVerifyLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.verifyMfaLogin(
      dto.challengeToken,
      dto.code,
      this.sessionMeta(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    return { accessToken: tokens.accessToken };
  }

  @Get('mfa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estado de la verificación en dos pasos' })
  mfaStatus(@Req() req: AuthenticatedRequest) {
    return this.authService.mfaStatus(req.user.userId);
  }

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Generar un secreto TOTP para activar MFA' })
  setupMfa(@Req() req: AuthenticatedRequest) {
    return this.authService.setupMfa(req.user.userId);
  }

  @Post('mfa/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Activar MFA confirmando un código' })
  enableMfa(@Req() req: AuthenticatedRequest, @Body() dto: MfaCodeDto) {
    return this.authService.enableMfa(req.user.userId, dto.code, req.user.sessionId);
  }

  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Desactivar MFA (contraseña + código)' })
  disableMfa(@Req() req: AuthenticatedRequest, @Body() dto: MfaDisableDto) {
    return this.authService.disableMfa(
      req.user.userId,
      req.user.sessionId,
      dto.password,
      dto.code,
    );
  }

  @Post('mfa/step-up')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Token breve para acciones administrativas destructivas' })
  stepUp(@Req() req: AuthenticatedRequest, @Body() dto: MfaCodeDto) {
    return this.authService.stepUp(req.user.userId, dto.code);
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
    const refreshToken = this.refreshTokenFrom(req);
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
    return this.authService.logout(this.refreshTokenFrom(req) ?? '');
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

  private refreshCookieName(): string {
    return env.cookie.secure ? SECURE_REFRESH_COOKIE : LEGACY_REFRESH_COOKIE;
  }

  private refreshTokenFrom(req: Request): string | undefined {
    return (
      req.cookies?.[this.refreshCookieName()] ??
      req.cookies?.[LEGACY_REFRESH_COOKIE]
    ) as string | undefined;
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(this.refreshCookieName(), token, {
      ...this.refreshCookieOptions(),
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(res: Response): void {
    // Se limpian ambos nombres para cerrar también sesiones emitidas antes del
    // cambio al prefijo __Secure-.
    res.clearCookie(this.refreshCookieName(), this.refreshCookieOptions());
    res.clearCookie(LEGACY_REFRESH_COOKIE, this.refreshCookieOptions());
  }

  private sessionMeta(req: Request): SessionMeta {
    const userAgent = req.headers['user-agent'];
    return {
      ipAddress: req.ip ?? null,
      deviceInfo: Array.isArray(userAgent) ? userAgent.join(' ') : (userAgent ?? null),
    };
  }
}
