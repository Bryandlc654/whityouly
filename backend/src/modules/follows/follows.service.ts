import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoriesService } from '../stories/stories.service';
import { normalizeCharacterName } from '../characters/characters.service';

export interface FollowedCharacter {
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
}

export interface FollowedStory {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  author: { name: string; avatarUrl: string | null };
}

/**
 * Seguimiento de personajes e historias. Todo sigue a entidades de la identidad
 * pública (`Character`) y a relatos, nunca a cuentas.
 */
@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storiesService: StoriesService,
  ) {}

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

  async followStory(userId: string, storyId: string): Promise<{ following: true }> {
    // Solo se sigue un relato que se puede ver.
    await this.storiesService.assertStoryVisible(userId, storyId);
    const follower = await this.getOwnCharacter(userId);

    const existing = await this.prisma.follower.findFirst({
      where: { followerId: follower.id, followingStoryId: storyId },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.follower
        .create({ data: { followerId: follower.id, followingStoryId: storyId } })
        .catch((error) => {
          if (!this.isUniqueError(error)) throw error;
        });
    }

    return { following: true };
  }

  async unfollowStory(userId: string, storyId: string): Promise<{ following: false }> {
    const follower = await this.getOwnCharacter(userId);

    await this.prisma.follower.deleteMany({
      where: { followerId: follower.id, followingStoryId: storyId },
    });

    return { following: false };
  }

  /** Historias que sigue el usuario (con su autor), para "Lo que sigo". */
  async listFollowedStories(userId: string): Promise<FollowedStory[]> {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      return [];
    }

    const rows = await this.prisma.follower.findMany({
      where: { followerId: character.id, followingStoryId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        followingStory: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            character: { select: { name: true, avatarUrl: true } },
          },
        },
      },
    });

    return rows
      .map((row) => {
        const story = row.followingStory;
        if (!story) return null;
        return {
          id: story.id,
          title: story.title,
          createdAt: story.createdAt,
          updatedAt: story.updatedAt,
          author: {
            name: story.character.name,
            avatarUrl: story.character.avatarUrl,
          },
        };
      })
      .filter((row): row is FollowedStory => row !== null);
  }

  /** Resumen de "Lo que sigo": personajes e historias. */
  async whatIFollow(userId: string): Promise<{ characters: FollowedCharacter[]; stories: FollowedStory[] }> {
    const [characters, stories] = await Promise.all([
      this.listFollowing(userId),
      this.listFollowedStories(userId),
    ]);

    return { characters: characters.items, stories };
  }

  private isUniqueError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
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
