import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };
  let jwt: { verifyAsync: ReturnType<typeof vi.fn> };

  function contextFor(userId?: string, method = 'GET', headers: Record<string, unknown> = {}) {
    return {
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({
        getRequest: () => ({ user: userId ? { userId } : undefined, method, headers }),
      }),
    } as never;
  }

  beforeEach(async () => {
    reflector = { getAllAndOverride: vi.fn() };
    prisma = { user: { findUnique: vi.fn() } };
    jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'sa-1', type: 'step-up' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: reflector },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    guard = module.get(RolesGuard);
  });

  it('deja pasar a un ADMIN cuando el endpoint pide ADMIN o SUPERADMIN', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN', 'SUPERADMIN']);
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE', mfaEnabled: false });

    await expect(guard.canActivate(contextFor('u-1'))).resolves.toBe(true);
  });

  it('exige MFA activo a un SUPERADMIN', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPERADMIN', status: 'ACTIVE', mfaEnabled: false });

    await expect(guard.canActivate(contextFor('sa-1'))).rejects.toMatchObject({
      response: { code: 'MFA_ENROLL_REQUIRED' },
    });
  });

  it('deja pasar a un SUPERADMIN con MFA en una lectura', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPERADMIN', status: 'ACTIVE', mfaEnabled: true });

    await expect(guard.canActivate(contextFor('sa-1'))).resolves.toBe(true);
  });

  it('exige step-up en mutaciones de SUPERADMIN', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPERADMIN', status: 'ACTIVE', mfaEnabled: true });

    await expect(guard.canActivate(contextFor('sa-1', 'PATCH'))).rejects.toMatchObject({
      response: { code: 'STEP_UP_REQUIRED' },
    });
  });

  it('acepta un step-up válido en mutaciones de SUPERADMIN', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPERADMIN', status: 'ACTIVE', mfaEnabled: true });

    await expect(
      guard.canActivate(contextFor('sa-1', 'PATCH', { 'x-step-up': 'token' })),
    ).resolves.toBe(true);
  });

  it('bloquea a un USER en un endpoint de ADMIN', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    prisma.user.findUnique.mockResolvedValue({ role: 'USER', status: 'ACTIVE' });

    await expect(guard.canActivate(contextFor('u-1'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('bloquea a un MODERATOR en un endpoint que exige SUPERADMIN', async () => {
    reflector.getAllAndOverride.mockReturnValue(['SUPERADMIN']);
    prisma.user.findUnique.mockResolvedValue({ role: 'MODERATOR', status: 'ACTIVE' });

    await expect(guard.canActivate(contextFor('m-1'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('bloquea una cuenta suspendida aunque tenga el rol necesario', async () => {
    reflector.getAllAndOverride.mockReturnValue(['SUPERADMIN']);
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPERADMIN', status: 'SUSPENDED' });

    await expect(guard.canActivate(contextFor('sa-1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('bloquea una cuenta dada de baja', async () => {
    reflector.getAllAndOverride.mockReturnValue(['SUPERADMIN']);
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPERADMIN', status: 'DELETED' });

    await expect(guard.canActivate(contextFor('sa-1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechaza peticiones sin sesión antes de tocar la base', async () => {
    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza si la cuenta ya no existe', async () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor('fantasma'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('deja pasar a cualquier activo en un endpoint sin @Roles', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    prisma.user.findUnique.mockResolvedValue({ role: 'USER', status: 'ACTIVE' });

    await expect(guard.canActivate(contextFor('u-1'))).resolves.toBe(true);
  });

  it('consulta siempre el rol en la base, sin confiar en el token', async () => {
    reflector.getAllAndOverride.mockReturnValue(['SUPERADMIN']);
    prisma.user.findUnique.mockResolvedValue({ role: 'USER', status: 'ACTIVE' });

    await expect(guard.canActivate(contextFor('u-1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      select: { role: true, status: true, mfaEnabled: true },
    });
    expect(ROLES_KEY).toBe('roles');
  });
});
