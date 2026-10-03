import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { SessionsService } from './sessions.service.js';
import { PasswordBreachService } from './password-breach.service.js';
import { LoginAttemptsService } from './login-attempts.service.js';
import { AuthAuditService } from './auth-audit.service.js';
import { CooldownService } from '../../common/cooldown/cooldown.service.js';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';

interface Mocks {
  usersService: {
    createUser: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    updatePassword: ReturnType<typeof vi.fn>;
    updatePasswordIfMatches: ReturnType<typeof vi.fn>;
    markEmailAsVerified: ReturnType<typeof vi.fn>;
  };
  sessionsService: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
    revokeByTokenHash: ReturnType<typeof vi.fn>;
    revokeAllForUser: ReturnType<typeof vi.fn>;
    enforceLimit: ReturnType<typeof vi.fn>;
    deleteExpired: ReturnType<typeof vi.fn>;
    listActiveForUser: ReturnType<typeof vi.fn>;
    revokeIfOwned: ReturnType<typeof vi.fn>;
    revokeAllForUserExcept: ReturnType<typeof vi.fn>;
  };
  passwordBreachService: { isBreached: ReturnType<typeof vi.fn> };
  loginAttemptsService: {
    getStatus: ReturnType<typeof vi.fn>;
    recordFailure: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };
  auditService: {
    logLoginSuccess: ReturnType<typeof vi.fn>;
    logLoginFailure: ReturnType<typeof vi.fn>;
    logAccountLocked: ReturnType<typeof vi.fn>;
    logPasswordReset: ReturnType<typeof vi.fn>;
    logTokenReuse: ReturnType<typeof vi.fn>;
    logSessionRevoked: ReturnType<typeof vi.fn>;
  };
  cooldownService: { consume: ReturnType<typeof vi.fn> };
  jwtService: {
    signAsync: ReturnType<typeof vi.fn>;
    verifyAsync: ReturnType<typeof vi.fn>;
    decode: ReturnType<typeof vi.fn>;
  };
  mailerService: { sendMail: ReturnType<typeof vi.fn> };
}

describe('AuthService', () => {
  let service: AuthService;
  let mocks: Mocks;

  beforeEach(async () => {
    mocks = {
      usersService: {
        createUser: vi.fn(),
        findByEmail: vi.fn(),
        findById: vi.fn(),
        updatePassword: vi.fn(),
        updatePasswordIfMatches: vi.fn().mockResolvedValue(true),
        markEmailAsVerified: vi.fn(),
      },
      sessionsService: {
        create: vi.fn().mockResolvedValue({}),
        findById: vi.fn(),
        revoke: vi.fn(),
        revokeByTokenHash: vi.fn(),
        revokeAllForUser: vi.fn(),
        enforceLimit: vi.fn().mockResolvedValue(0),
        deleteExpired: vi.fn().mockResolvedValue(0),
        listActiveForUser: vi.fn().mockResolvedValue([]),
        revokeIfOwned: vi.fn().mockResolvedValue(true),
        revokeAllForUserExcept: vi.fn().mockResolvedValue(2),
      },
      passwordBreachService: { isBreached: vi.fn().mockResolvedValue(false) },
      loginAttemptsService: {
        getStatus: vi.fn().mockResolvedValue({ locked: false, retryAfterSeconds: 0 }),
        recordFailure: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
      },
      auditService: {
        logLoginSuccess: vi.fn().mockResolvedValue(undefined),
        logLoginFailure: vi.fn().mockResolvedValue(undefined),
        logAccountLocked: vi.fn().mockResolvedValue(undefined),
        logPasswordReset: vi.fn().mockResolvedValue(undefined),
        logTokenReuse: vi.fn().mockResolvedValue(undefined),
        logSessionRevoked: vi.fn().mockResolvedValue(undefined),
      },
      cooldownService: {
        consume: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
      },
      jwtService: {
        signAsync: vi.fn().mockResolvedValue('signed-token'),
        verifyAsync: vi.fn(),
        decode: vi.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      },
      mailerService: { sendMail: vi.fn().mockResolvedValue(undefined) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mocks.usersService },
        { provide: SessionsService, useValue: mocks.sessionsService },
        { provide: PasswordBreachService, useValue: mocks.passwordBreachService },
        { provide: LoginAttemptsService, useValue: mocks.loginAttemptsService },
        { provide: AuthAuditService, useValue: mocks.auditService },
        { provide: CooldownService, useValue: mocks.cooldownService },
        { provide: JwtService, useValue: mocks.jwtService },
        { provide: MailerService, useValue: mocks.mailerService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registra al usuario, envía el correo de verificación y NO devuelve tokens', async () => {
    mocks.usersService.createUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

    const result = await service.register({
      email: 'user@example.com',
      password: 'Secret123',
    } as any);

    expect(mocks.usersService.createUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      passwordHash: 'Secret123',
    });
    expect(mocks.mailerService.sendMail).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
    expect(result.message).toContain('Cuenta creada');
  });

  it('rechaza el registro si la contraseña está filtrada', async () => {
    mocks.passwordBreachService.isBreached.mockResolvedValue(true);

    await expect(
      service.register({ email: 'user@example.com', password: 'Secret123' } as any),
    ).rejects.toThrow();
    expect(mocks.usersService.createUser).not.toHaveBeenCalled();
  });

  it('revoca todas las sesiones al reutilizar un refresh token ya rotado', async () => {
    mocks.jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      sid: 'session-1',
      type: 'refresh',
    });
    mocks.sessionsService.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      // El hash almacenado coincide con el token presentado, pero la sesión ya fue rotada.
      refreshToken: createHash('sha256').update('refresh-token').digest('hex'),
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mocks.sessionsService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(mocks.auditService.logTokenReuse).toHaveBeenCalled();
  });

  it('rechaza un refresh token que no corresponde a la sesión', async () => {
    mocks.jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      sid: 'session-1',
      type: 'refresh',
    });
    mocks.sessionsService.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      refreshToken: 'hash-de-otro-token',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mocks.sessionsService.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('bloquea el login cuando la cuenta supera los intentos fallidos', async () => {
    mocks.loginAttemptsService.getStatus.mockResolvedValue({
      locked: true,
      retryAfterSeconds: 120,
    });

    await expect(
      service.login({ email: 'user@example.com', password: 'Secret123' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(mocks.auditService.logAccountLocked).toHaveBeenCalled();
    expect(mocks.usersService.findByEmail).not.toHaveBeenCalled();
  });

  it('registra el fallo y responde con un error genérico', async () => {
    mocks.usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'user@example.com', password: 'Secret123' } as any),
    ).rejects.toThrow('Credenciales inválidas');

    expect(mocks.loginAttemptsService.recordFailure).toHaveBeenCalledWith('user@example.com');
    expect(mocks.auditService.logLoginFailure).toHaveBeenCalled();
  });

  it('restablece la contraseña, revoca sesiones y notifica por correo', async () => {
    mocks.jwtService.decode.mockReturnValue({ sub: 'user-1', type: 'password-reset' });
    mocks.jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'password-reset' });
    mocks.usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'old-hash',
    });

    const result = await service.resetPassword({
      token: 'reset-token',
      newPassword: 'NewSecret123',
    } as any);

    expect(mocks.usersService.updatePasswordIfMatches).toHaveBeenCalledWith(
      'user-1',
      'old-hash',
      'NewSecret123',
    );
    expect(mocks.sessionsService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(mocks.auditService.logPasswordReset).toHaveBeenCalled();
    expect(mocks.mailerService.sendMail).toHaveBeenCalled();
    expect(result.message).toContain('Contraseña actualizada');
  });

  it('rechaza un token de recuperación ya usado (update condicional falla)', async () => {
    mocks.jwtService.decode.mockReturnValue({ sub: 'user-1', type: 'password-reset' });
    mocks.jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'password-reset' });
    mocks.usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'old-hash',
    });
    mocks.usersService.updatePasswordIfMatches.mockResolvedValue(false);

    await expect(
      service.resetPassword({ token: 'reset-token', newPassword: 'NewSecret123' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.sessionsService.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('no revela si el correo existe en forgot-password', async () => {
    mocks.usersService.findByEmail.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: 'nadie@example.com' } as any);

    expect(mocks.mailerService.sendMail).not.toHaveBeenCalled();
    expect(result.message).toContain('Si el correo existe');
  });

  it('marca la sesión actual al listar sesiones', async () => {
    mocks.sessionsService.listActiveForUser.mockResolvedValue([
      { id: 'current', deviceInfo: 'dev', ipAddress: '1.2.3.4', createdAt: new Date(), expiresAt: new Date() },
      { id: 'other', deviceInfo: null, ipAddress: null, createdAt: new Date(), expiresAt: new Date() },
    ]);

    const sessions = await service.listSessions('user-1', 'current');

    expect(sessions).toHaveLength(2);
    expect(sessions[0].current).toBe(true);
    expect(sessions[1].current).toBe(false);
  });

  it('devuelve 404 si la sesión a cerrar no pertenece al usuario', async () => {
    mocks.sessionsService.revokeIfOwned.mockResolvedValue(false);

    await expect(service.revokeSession('user-1', 'session-x', 'current')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mocks.auditService.logSessionRevoked).not.toHaveBeenCalled();
  });

  it('revoca las demás sesiones conservando la actual', async () => {
    mocks.sessionsService.revokeAllForUserExcept.mockResolvedValue(3);

    const result = await service.revokeOtherSessions('user-1', 'current');

    expect(mocks.sessionsService.revokeAllForUserExcept).toHaveBeenCalledWith('user-1', 'current');
    expect(result.revokedCount).toBe(3);
  });
});
