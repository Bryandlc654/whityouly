import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtStrategy } from './jwt.strategy';
import type { PrismaService } from '../../../prisma/prisma.service';

const prisma = {
  session: { findUnique: vi.fn() },
};

const activeSession = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  user: { status: 'ACTIVE' },
  ...overrides,
});

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new JwtStrategy(prisma as unknown as PrismaService);
  });

  it('acepta un access token con una sesión viva', async () => {
    prisma.session.findUnique.mockResolvedValue(activeSession());

    await expect(
      strategy.validate({ sub: 'user-1', email: 'a@b.c', sid: 'session-1', type: 'access' }),
    ).resolves.toMatchObject({ userId: 'user-1', sessionId: 'session-1' });
  });

  it('rechaza un token sin sesión asociada', async () => {
    await expect(strategy.validate({ sub: 'user-1', type: 'access' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza una sesión revocada (logout inmediato)', async () => {
    prisma.session.findUnique.mockResolvedValue(activeSession({ revokedAt: new Date() }));

    await expect(
      strategy.validate({ sub: 'user-1', sid: 'session-1', type: 'access' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza una sesión caducada', async () => {
    prisma.session.findUnique.mockResolvedValue(
      activeSession({ expiresAt: new Date(Date.now() - 1_000) }),
    );

    await expect(
      strategy.validate({ sub: 'user-1', sid: 'session-1', type: 'access' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza el token de una cuenta suspendida', async () => {
    prisma.session.findUnique.mockResolvedValue(
      activeSession({ user: { status: 'SUSPENDED' } }),
    );

    await expect(
      strategy.validate({ sub: 'user-1', sid: 'session-1', type: 'access' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza un refresh token usado como access token', async () => {
    await expect(
      strategy.validate({ sub: 'user-1', sid: 'session-1', type: 'refresh' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
