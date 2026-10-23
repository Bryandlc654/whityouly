import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoriesService } from '../stories/stories.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_ENTITY, NOTIFICATION_TYPES } from '../notifications/notification-types';
import { STORY_FOLLOW_LEVEL } from './follow-levels';
import {
  normalizeCharacterName,
  resolvePrivacySettings,
  type ResolvedPrivacy,
} from '../characters/characters.service';
import type { ListConnectionsQueryDto } from './dto/follows.dto';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export interface FollowedCharacter {
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
}

/** Persona dentro de una lista pública de seguidores o seguidos. */
export interface SocialConnection {
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
  /** Si la persona que consulta sigue a esta. */
  following: boolean;
  /** La fila corresponde a quien consulta. */
  isSelf: boolean;
}

export interface SocialConnectionPage {
  items: SocialConnection[];
  nextCursor: string | null;
  total: number;
  showFollowing: boolean;
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
    private readonly notifications: NotificationsService,
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

      // Solo al crear el vínculo (no en un seguimiento repetido) y nunca a uno
      // mismo, que ya se ha rechazado antes.
      await this.notifications.create({
        userId: target.userId,
        actorCharacterId: follower.id,
        type: NOTIFICATION_TYPES.FOLLOW,
        entityType: NOTIFICATION_ENTITY.CHARACTER,
        entityId: target.id,
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

  /**
   * Seguidores públicos de un personaje. La lista solo es accesible si el
   * perfil es público (o si quien consulta es su dueño) y se pagina por cursor
   * para no cargar una lista ilimitada.
   */
  async listFollowers(
    viewerUserId: string,
    rawName: string,
    query: ListConnectionsQueryDto,
  ): Promise<SocialConnectionPage> {
    const target = await this.resolveSocialTarget(rawName, viewerUserId);
    const limit = this.pageSize(query.limit);

    const [rows, total, viewer] = await Promise.all([
      this.prisma.follower.findMany({
        where: {
          followingCharacterId: target.id,
          follower: { is: { user: { is: { status: 'ACTIVE' } } } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          follower: {
            select: { name: true, tagline: true, avatarUrl: true, privacySettings: true },
          },
        },
      }),
      this.prisma.follower.count({
        where: {
          followingCharacterId: target.id,
          follower: { is: { user: { is: { status: 'ACTIVE' } } } },
        },
      }),
      this.prisma.character.findUnique({
        where: { userId: viewerUserId },
        select: { id: true, name: true },
      }),
    ]);

    return this.buildConnectionsPage({
      rows: rows.map((row) => ({ id: row.id, character: row.follower })),
      limit,
      total,
      viewer,
      showFollowing: target.privacy.showFollowing,
    });
  }

  /**
   * Personajes que sigue un perfil. Solo el dueño ve siempre la lista; el resto
   * necesita que `showFollowing` esté activo. Así el ajuste de privacidad no se
   * puede eludir cambiando la URL.
   */
  async listFollowingOf(
    viewerUserId: string,
    rawName: string,
    query: ListConnectionsQueryDto,
  ): Promise<SocialConnectionPage> {
    const target = await this.resolveSocialTarget(rawName, viewerUserId);
    const isOwner = target.userId === viewerUserId;

    if (!isOwner && !target.privacy.showFollowing) {
      throw new ForbiddenException('Este perfil no comparte a quién sigue.');
    }

    const limit = this.pageSize(query.limit);
    const where: Prisma.FollowerWhereInput = {
      followerId: target.id,
      followingCharacter: { is: { user: { is: { status: 'ACTIVE' } } } },
    };

    const [rows, total, viewer] = await Promise.all([
      this.prisma.follower.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          followingCharacter: {
            select: { name: true, tagline: true, avatarUrl: true, privacySettings: true },
          },
        },
      }),
      this.prisma.follower.count({ where }),
      this.prisma.character.findUnique({
        where: { userId: viewerUserId },
        select: { id: true, name: true },
      }),
    ]);

    return this.buildConnectionsPage({
      rows: rows
        .filter((row) => row.followingCharacter !== null)
        .map((row) => ({ id: row.id, character: row.followingCharacter! })),
      limit,
      total,
      viewer,
      showFollowing: target.privacy.showFollowing,
    });
  }

  async followStory(userId: string, storyId: string): Promise<{ following: true }> {
    // Solo se sigue un relato que se puede ver.
    await this.storiesService.assertStoryVisible(userId, storyId);
    const follower = await this.getOwnCharacter(userId);

    const existing = await this.prisma.follower.findFirst({
      where: { followerId: follower.id, followingStoryId: storyId },
      select: { id: true, notifyLevel: true },
    });

    // "Estoy contigo" pudo crear un seguimiento conservador: al pulsar "Seguir
    // relato" se sube a avisos completos reutilizando la misma fila.
    if (existing) {
      if (existing.notifyLevel !== STORY_FOLLOW_LEVEL.ALL) {
        await this.prisma.follower.update({
          where: { id: existing.id },
          data: { notifyLevel: STORY_FOLLOW_LEVEL.ALL },
        });
      }
      return { following: true };
    }

    await this.prisma.follower
      .create({
        data: {
          followerId: follower.id,
          followingStoryId: storyId,
          notifyLevel: STORY_FOLLOW_LEVEL.ALL,
        },
      })
      .catch((error) => {
        if (!this.isUniqueError(error)) throw error;
      });

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
      where: {
        followerId: character.id,
        followingStoryId: { not: null },
        followingStory: { is: { status: StoryStatus.PUBLISHED } },
      },
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

  private pageSize(limit?: number): number {
    return Math.min(Math.max(limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  }

  private async buildConnectionsPage(params: {
    rows: {
      id: string;
      character: {
        name: string;
        tagline: string | null;
        avatarUrl: string | null;
        privacySettings: unknown;
      };
    }[];
    limit: number;
    total: number;
    viewer: { id: string; name: string } | null;
    showFollowing: boolean;
  }): Promise<SocialConnectionPage> {
    const hasMore = params.rows.length > params.limit;
    const pageRows = hasMore ? params.rows.slice(0, params.limit) : params.rows;
    const names = pageRows.map((row) => row.character.name);

    const followedNames = new Set<string>();
    if (params.viewer && names.length > 0) {
      const followed = await this.prisma.follower.findMany({
        where: {
          followerId: params.viewer.id,
          followingCharacter: { name: { in: names } },
        },
        select: { followingCharacter: { select: { name: true } } },
      });

      for (const row of followed) {
        if (row.followingCharacter) {
          followedNames.add(row.followingCharacter.name.toLowerCase());
        }
      }
    }

    const viewerName = params.viewer?.name.toLowerCase() ?? null;

    const items = pageRows.map((row) => {
      const privacy = resolvePrivacySettings(row.character.privacySettings);
      // Un perfil privado no expone ni lema ni avatar en listas ajenas; solo su
      // seudónimo. Así no se filtra contenido que el perfil oculta en su vista.
      const exposesProfile = privacy.profileVisibility === 'PUBLIC';

      return {
        name: row.character.name,
        tagline: exposesProfile && privacy.showBio ? row.character.tagline : null,
        avatarUrl: exposesProfile && privacy.showAvatar ? row.character.avatarUrl : null,
        following: followedNames.has(row.character.name.toLowerCase()),
        isSelf: viewerName !== null && row.character.name.toLowerCase() === viewerName,
      } satisfies SocialConnection;
    });

    return {
      items,
      nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null,
      total: params.total,
      showFollowing: params.showFollowing,
    };
  }

  /**
   * Resuelve el personaje objetivo de una lista aplicando la misma regla que el
   * perfil público: un perfil privado responde 404 salvo para su dueño. Nunca
   * se distingue de un seudónimo inexistente para no filtrar su existencia.
   */
  private async resolveSocialTarget(
    rawName: string,
    viewerUserId: string,
  ): Promise<{ id: string; userId: string; privacy: ResolvedPrivacy }> {
    const name = normalizeCharacterName(rawName);

    if (!name || name.length > 30) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "characters" WHERE lower("name") = lower(${name}) LIMIT 1
    `;
    const match = rows[0];

    if (!match) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    const character = await this.prisma.character.findUnique({
      where: { id: match.id },
      select: {
        id: true,
        userId: true,
        privacySettings: true,
        user: { select: { status: true } },
      },
    });

    if (!character || character.user.status !== 'ACTIVE') {
      throw new NotFoundException('Personaje no encontrado.');
    }

    const privacy = resolvePrivacySettings(character.privacySettings);
    const isOwner = character.userId === viewerUserId;

    if (!isOwner && privacy.profileVisibility !== 'PUBLIC') {
      throw new NotFoundException('Personaje no encontrado.');
    }

    return { id: character.id, userId: character.userId, privacy };
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

  private async resolveTarget(rawName: string): Promise<{ id: string; userId: string }> {
    const name = normalizeCharacterName(rawName);

    if (!name || name.length > 30) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    // Mismo criterio que el perfil público: el nombre se resuelve sin distinguir
    // mayúsculas contra el índice funcional. Se trae el `userId` para poder
    // notificar al propietario sin una consulta extra.
    const rows = await this.prisma.$queryRaw<{ id: string; userId: string }[]>`
      SELECT "id", "userId" FROM "characters" WHERE lower("name") = lower(${name}) LIMIT 1
    `;

    const target = rows[0];
    if (!target) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    return target;
  }
}
