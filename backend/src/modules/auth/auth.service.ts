import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendVerificationDto,
} from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '@prisma/client';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import { SessionsService } from './sessions.service';
import { PasswordBreachService } from './password-breach.service';
import { LoginAttemptsService } from './login-attempts.service';
import { AuthAuditService } from './auth-audit.service';
import { CooldownService } from '../../common/cooldown/cooldown.service';

// Hash de referencia (contraseña aleatoria) para igualar el tiempo de respuesta
// cuando el usuario no existe y evitar enumeración de cuentas por timing.
const DUMMY_HASH = '$2b$12$VgDJYavMipaIb6jpsflBMGTdsOddUxJyjv8XXDC0dzuEqZfkbURu0';

export interface SessionMeta {
  ipAddress?: string | null;
  deviceInfo?: string | null;
}

interface TokenPayload {
  sub: string;
  email: string;
  sid?: string;
  type?: string;
}

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

// Comparación en tiempo constante para hashes del mismo largo.
const safeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private sessionsService: SessionsService,
    private jwtService: JwtService,
    private mailerService: MailerService,
    private passwordBreachService: PasswordBreachService,
    private loginAttemptsService: LoginAttemptsService,
    private auditService: AuthAuditService,
    private cooldownService: CooldownService,
  ) {}

  async register(registerDto: RegisterDto) {
    await this.assertPasswordNotBreached(registerDto.password);

    const user = await this.usersService.createUser({
      email: registerDto.email,
      passwordHash: registerDto.password,
    });

    await this.sendVerificationEmail(user);

    return { message: 'Cuenta creada. Por favor, revisa tu correo electrónico para verificarla.' };
  }

  async login(loginDto: LoginDto, meta: SessionMeta = {}) {
    // Bloqueo por cuenta: frena ataques distribuidos que evaden el límite por IP.
    const lockStatus = await this.loginAttemptsService.getStatus(loginDto.email);
    if (lockStatus.locked) {
      await this.auditService.logAccountLocked({
        ip: meta.ipAddress,
        deviceInfo: meta.deviceInfo,
        reason: 'locked',
      });
      throw new UnauthorizedException(
        `Demasiados intentos fallidos. Inténtalo de nuevo en ${lockStatus.retryAfterSeconds} segundos.`,
      );
    }

    const user = await this.usersService.findByEmail(loginDto.email);

    // Comparamos siempre contra un hash válido para no filtrar si el correo existe.
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !user.passwordHash || !isPasswordValid) {
      await this.loginAttemptsService.recordFailure(loginDto.email);
      await this.auditService.logLoginFailure({
        userId: user?.id ?? null,
        ip: meta.ipAddress,
        deviceInfo: meta.deviceInfo,
        reason: 'invalid_credentials',
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.status !== 'ACTIVE') {
      await this.auditService.logLoginFailure({
        userId: user.id,
        ip: meta.ipAddress,
        deviceInfo: meta.deviceInfo,
        reason: `status_${user.status.toLowerCase()}`,
      });
      throw new UnauthorizedException('Tu cuenta no está activa');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Por favor, verifica tu correo electrónico antes de iniciar sesión');
    }

    // Éxito: limpiamos el contador de fallos y registramos el evento.
    await this.loginAttemptsService.reset(loginDto.email);

    // Actualización transparente del costo del hash si la política cambió.
    if (this.usersService.isPasswordHashOutdated(user.passwordHash)) {
      await this.usersService.updatePassword(user.id, loginDto.password);
    }

    await this.auditService.logLoginSuccess({
      userId: user.id,
      ip: meta.ipAddress,
      deviceInfo: meta.deviceInfo,
    });

    return this.issueSession(user, meta);
  }

  async refresh(refreshToken: string, meta: SessionMeta = {}) {
    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(refreshToken, {
        secret: env.jwtRefreshSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (payload.type !== 'refresh' || !payload.sid) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const session = await this.sessionsService.findById(payload.sid);
    if (!session) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // El token debe corresponder exactamente a la sesión (comparación en tiempo constante).
    if (!safeEqual(session.refreshToken, hashToken(refreshToken))) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Reutilización de un token ya rotado/revocado => posible robo:
    // revocamos todas las sesiones del usuario (respuesta defensiva).
    if (session.revokedAt) {
      await this.sessionsService.revokeAllForUser(session.userId);
      await this.auditService.logTokenReuse({
        userId: session.userId,
        ip: meta.ipAddress,
        deviceInfo: meta.deviceInfo,
        reason: 'rotated_token_reuse',
      });
      throw new UnauthorizedException('Refresh token reutilizado: sesiones revocadas por seguridad');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('La sesión ha expirado');
    }

    const user = await this.usersService.findById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('La cuenta no está activa');
    }

    // Rotación: se revoca la sesión actual y se emite una nueva.
    await this.sessionsService.revoke(session.id);
    return this.issueSession(user, meta);
  }

  async logout(refreshToken: string) {
    if (refreshToken) {
      await this.sessionsService.revokeByTokenHash(hashToken(refreshToken));
    }
    return { message: 'Sesión cerrada exitosamente.' };
  }

  async logoutAll(userId: string) {
    await this.sessionsService.revokeAllForUser(userId);
    return { message: 'Todas las sesiones han sido cerradas.' };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.sessionsService.listActiveForUser(userId);

    return sessions.map((session) => ({
      id: session.id,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      current: session.id === currentSessionId,
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId?: string,
    meta: SessionMeta = {},
  ) {
    const revoked = await this.sessionsService.revokeIfOwned(sessionId, userId);
    if (!revoked) {
      // No existe, no es del usuario o ya estaba revocada: no revelamos cuál.
      throw new NotFoundException('Sesión no encontrada');
    }

    await this.auditService.logSessionRevoked({
      userId,
      ip: meta.ipAddress,
      deviceInfo: meta.deviceInfo,
      reason: sessionId === currentSessionId ? 'self' : 'other',
    });

    return { message: 'Sesión cerrada exitosamente.' };
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId?: string,
    meta: SessionMeta = {},
  ) {
    const revokedCount = currentSessionId
      ? await this.sessionsService.revokeAllForUserExcept(userId, currentSessionId)
      : await this.sessionsService.revokeAllForUser(userId);

    await this.auditService.logSessionRevoked({
      userId,
      ip: meta.ipAddress,
      deviceInfo: meta.deviceInfo,
      reason: 'others',
    });

    return {
      message: `Se cerraron ${revokedCount} sesiones en otros dispositivos.`,
      revokedCount,
    };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('El enlace de verificación es inválido o ha expirado');
    }

    const decoded = this.jwtService.decode(token) as TokenPayload | null;
    if (!decoded?.sub || decoded.type !== 'email-verification') {
      throw new BadRequestException('El enlace de verificación es inválido o ha expirado');
    }

    const user = await this.usersService.findById(decoded.sub);
    if (!user) {
      throw new BadRequestException('El enlace de verificación es inválido o ha expirado');
    }

    try {
      await this.jwtService.verifyAsync(token, {
        secret: this.verificationSecret(user),
        algorithms: ['HS256'],
      });
    } catch {
      throw new BadRequestException('El enlace de verificación es inválido, ya fue usado o ha expirado');
    }

    if (!user.isEmailVerified) {
      await this.usersService.markEmailAsVerified(user.id);
    }

    return { message: 'Correo verificado exitosamente. Ya puedes iniciar sesión.' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.usersService.findByEmail(dto.email);
    const message = 'Si el correo requiere verificación, se ha enviado un nuevo enlace.';

    if (!user || user.isEmailVerified) {
      return { message };
    }

    const cooldown = await this.cooldownService.consume(
      `email-verification:${user.id}`,
      env.emailResendCooldownMs,
    );
    if (!cooldown.allowed) {
      return { message };
    }

    await this.sendVerificationEmail(user);
    return { message };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const genericMessage = { message: 'Si el correo existe, se ha enviado un enlace de recuperación.' };

    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      // Por seguridad, devolvemos success incluso si no existe, para no filtrar emails
      return genericMessage;
    }

    // Cooldown por cuenta: evita el spam de correos a un mismo destinatario.
    const cooldown = await this.cooldownService.consume(
      `password-reset:${user.id}`,
      env.passwordResetCooldownMs,
    );
    if (!cooldown.allowed) {
      return genericMessage;
    }

    // Token con propósito explícito, firmado con un secreto ligado al hash actual:
    // si la contraseña cambia, el token queda invalidado automáticamente (uso único).
    const secret = env.jwtSecret + user.passwordHash;
    const token = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, type: 'password-reset' },
      { secret, expiresIn: env.jwtPasswordResetExpiresIn },
    );

    const resetLink = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    // Envío no bloqueante: la respuesta no depende del SMTP (evita filtrar por
    // tiempo si el correo existe) y no mantiene ocupado el request.
    this.dispatchMail(
      {
        to: user.email,
        subject: 'Whityouly - Recuperación de contraseña',
        text: `Hola, has solicitado restablecer tu contraseña. Ingresa al siguiente enlace (expira en 15 minutos): \n\n${resetLink}\n\nSi no fuiste tú, ignora este correo.`,
        html: `
          <h3>Recuperación de contraseña</h3>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente botón (expira en 15 minutos):</p>
          <a href="${resetLink}" style="padding: 10px 20px; background-color: #4648d4; color: white; text-decoration: none; border-radius: 5px;">Restablecer Contraseña</a>
          <p>O copia este enlace: <br/> ${resetLink}</p>
        `,
      },
      'correo de recuperación',
    );

    return genericMessage;
  }

  async resetPassword(dto: ResetPasswordDto) {
    await this.assertPasswordNotBreached(dto.newPassword);

    // Decodificamos para obtener el usuario; la firma se verifica después con
    // un secreto derivado del hash de contraseña actual.
    const decoded = this.jwtService.decode(dto.token) as { sub?: string; type?: string } | null;
    if (!decoded?.sub || decoded.type !== 'password-reset') {
      throw new BadRequestException('El token es inválido o ya expiró');
    }

    const user = await this.usersService.findById(decoded.sub);
    if (!user || !user.passwordHash) {
      throw new BadRequestException('El token es inválido o ya expiró');
    }

    const secret = env.jwtSecret + user.passwordHash;
    try {
      await this.jwtService.verifyAsync(dto.token, { secret, algorithms: ['HS256'] });
    } catch {
      throw new BadRequestException('El token es inválido, ya fue usado o expiró');
    }

    // Update condicional y atómico: si el hash ya cambió (token reutilizado en
    // paralelo), no actualiza y devolvemos error.
    const updated = await this.usersService.updatePasswordIfMatches(
      user.id,
      user.passwordHash,
      dto.newPassword,
    );
    if (!updated) {
      throw new BadRequestException('El token es inválido, ya fue usado o expiró');
    }

    // Cerramos todas las sesiones por seguridad tras un cambio de contraseña
    await this.sessionsService.revokeAllForUser(user.id);

    await this.auditService.logPasswordReset({
      userId: user.id,
      email: user.email,
    });

    this.sendPasswordChangedEmail(user);

    return { message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.' };
  }

  private async issueSession(user: User, meta: SessionMeta) {
    const sessionId = randomUUID();
    const basePayload = { sub: user.id, email: user.email, sid: sessionId };

    const accessToken = await this.jwtService.signAsync(
      { ...basePayload, type: 'access' },
      { expiresIn: env.jwtAccessExpiresIn },
    );

    const refreshToken = await this.jwtService.signAsync(
      { ...basePayload, type: 'refresh' },
      { secret: env.jwtRefreshSecret, expiresIn: env.jwtRefreshExpiresIn },
    );

    const decoded = this.jwtService.decode(refreshToken) as { exp: number };
    const refreshTokenExpiresAt = new Date(decoded.exp * 1000);

    await this.sessionsService.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      ipAddress: meta.ipAddress ?? null,
      deviceInfo: meta.deviceInfo ?? null,
    });

    // Límite de sesiones activas por usuario (revoca las más antiguas).
    await this.sessionsService.enforceLimit(user.id, env.maxSessionsPerUser);

    return { accessToken, refreshToken, refreshTokenExpiresAt };
  }

  private async sendVerificationEmail(user: User) {
    const token = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, type: 'email-verification' },
      { secret: this.verificationSecret(user), expiresIn: env.jwtEmailVerificationExpiresIn },
    );
    const verifyLink = `${env.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Whityouly - Verifica tu cuenta',
        text: `Bienvenido a Whityouly. Por favor, verifica tu correo en el siguiente enlace: \n\n${verifyLink}`,
        html: `
          <h3>Bienvenido a tu Refugio</h3>
          <p>Solo falta un paso. Por favor, haz clic en el siguiente botón para verificar tu cuenta:</p>
          <a href="${verifyLink}" style="padding: 10px 20px; background-color: #4648d4; color: white; text-decoration: none; border-radius: 5px;">Verificar mi cuenta</a>
        `,
      });
    } catch (e) {
      // No bloqueamos el registro por un fallo del proveedor de correo,
      // pero lo registramos para poder diagnosticarlo.
      console.error('Error enviando correo de verificación:', e);
    }
  }

  // El secreto depende del estado de verificación: una vez verificado, el token
  // deja de ser válido (uso único) sin necesidad de almacenar el token en la BD.
  private verificationSecret(user: Pick<User, 'passwordHash' | 'isEmailVerified'>): string {
    const state = user.isEmailVerified ? 'done' : 'pending';
    return `${env.jwtSecret}:verify:${user.passwordHash ?? 'none'}:${state}`;
  }

  private async assertPasswordNotBreached(password: string) {
    const isBreached = await this.passwordBreachService.isBreached(password);
    if (isBreached) {
      throw new BadRequestException(
        'Esta contraseña apareció en filtraciones de datos conocidas. Por favor, elige una diferente.',
      );
    }
  }

  private sendPasswordChangedEmail(user: User) {
    this.dispatchMail(
      {
        to: user.email,
        subject: 'Whityouly - Tu contraseña fue actualizada',
        text: 'La contraseña de tu cuenta fue restablecida correctamente. Si no fuiste tú, restablece tu contraseña de inmediato y contacta a soporte.',
        html: `
          <h3>Contraseña actualizada</h3>
          <p>La contraseña de tu cuenta fue restablecida correctamente.</p>
          <p>Si no fuiste tú, restablece tu contraseña de inmediato y contacta a soporte.</p>
        `,
      },
      'notificación de cambio de contraseña',
    );
  }

  private dispatchMail(
    message: { to: string; subject: string; text: string; html: string },
    label: string,
  ): void {
    void this.mailerService.sendMail(message).catch((error: Error) => {
      console.error(`Error enviando ${label}:`, error.message);
    });
  }
}
