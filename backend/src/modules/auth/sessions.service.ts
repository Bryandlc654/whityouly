import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Session } from '@prisma/client';

export interface CreateSessionInput {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  deviceInfo?: string | null;
  ipAddress?: string | null;
}

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateSessionInput): Promise<Session> {
    return this.prisma.session.create({
      data: {
        id: data.id,
        userId: data.userId,
        refreshToken: data.refreshTokenHash,
        expiresAt: data.expiresAt,
        deviceInfo: data.deviceInfo ?? null,
        ipAddress: data.ipAddress ?? null,
      },
    });
  }

  findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  listActiveForUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  async revokeIfOwned(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async revokeAllForUserExcept(userId: string, exceptSessionId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, NOT: { id: exceptSessionId } },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  revoke(id: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByTokenHash(refreshTokenHash: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { refreshToken: refreshTokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /**
   * Limita el número de sesiones activas por usuario, revocando las más antiguas.
   * Evita el crecimiento ilimitado de sesiones y reduce la superficie de ataque.
   */
  async enforceLimit(userId: string, maxSessions: number): Promise<number> {
    const activeSessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (activeSessions.length <= maxSessions) {
      return 0;
    }

    const toRevoke = activeSessions.slice(maxSessions).map((session) => session.id);
    const result = await this.prisma.session.updateMany({
      where: { id: { in: toRevoke } },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /**
   * Elimina sesiones cuya vida útil ya expiró. Las sesiones revocadas se
   * conservan hasta su expiración para poder detectar la reutilización de tokens.
   */
  async deleteExpired(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return result.count;
  }
}
