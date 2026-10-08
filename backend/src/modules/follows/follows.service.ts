import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeCharacterName } from '../characters/characters.service';

export interface FollowedCharacter {
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
}

/**
 * Seguimiento entre personajes. Solo se sigue a personajes (no a cuentas): la
 * identidad pública vive en `Character`, así que seguir es una relación entre
 * personajes y nunca revela a quién hay detrás.
 */
@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  async follow(userId: string, rawName: string): Promise<{ following: true }> {
    const follower = await this.getOwnCharacter(userId);
    const target = await this.resolveTarget(rawName);

    if (target.id === follower.id) {
      throw new BadRequestException('No puedes seguirte a ti mismo.');
    }

    // Idempotente: seguir dos veces no crea una fila de más. Se evita así que el
    // feed de seguidos duplique relatos.
    const existing = await this.prisma.follower.findFirst({
      where: { followerId: follower.id, followingCharacterId: target.id },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.follower.create({
        data: { followerId: follower.id, followingCharacterId: target.id },
      });
    }

    return { following: true };
  }

  async unfollow(userId: string, rawName: string): Promise<{ following: false }> {
    const follower = await this.getOwnCharacter(userId);
    const target = await this.resolveTarget(rawName);

    await this.prisma.follower.deleteMany({
      where: { followerId: follower.id, followingCharacterId: target.id },
    });

    return { following: false };
  }

  async listFollowing(userId: string): Promise<{ items: FollowedCharacter[] }> {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      return { items: [] };
    }

    const rows = await this.prisma.follower.findMany({
      where: { followerId: character.id, followingCharacter: { isNot: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        followingCharacter: { select: { name: true, tagline: true, avatarUrl: true } },
      },
    });

    return {
      items: rows
        .map((row) => row.followingCharacter)
        .filter((row): row is FollowedCharacter => row !== null),
    };
  }

  private async getOwnCharacter(userId: string): Promise<{ id: string }> {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      throw new ForbiddenException('Necesitas crear tu personaje antes de seguir a alguien.');
    }

    return character;
  }

  private async resolveTarget(rawName: string): Promise<{ id: string }> {
    const name = normalizeCharacterName(rawName);

    if (!name || name.length > 30) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    // Mismo criterio que el perfil público: el nombre se resuelve sin distinguir
    // mayúsculas contra el índice funcional.
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "characters" WHERE lower("name") = lower(${name}) LIMIT 1
    `;

    const target = rows[0];
    if (!target) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    return target;
  }
}
