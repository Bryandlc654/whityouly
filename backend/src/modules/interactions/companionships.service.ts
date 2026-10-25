import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TreePath } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoriesService } from '../stories/stories.service';
import { TreeService } from '../tree/tree.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NOTIFICATION_ENTITY, NOTIFICATION_TYPES } from '../notifications/notification-types';
import { STORY_FOLLOW_LEVEL } from '../follows/follow-levels';
import { normalizeCharacterName } from '../characters/characters.service';

/**
 * Acompañamiento ("Estoy contigo"): un personaje acompaña una vez a cada relato
 * o personaje. La unicidad la garantizan los índices parciales de la base y se
 * comprueba también aquí para avisar con un mensaje claro.
 */
@Injectable()
export class CompanionshipsService {
  private readonly logger = new Logger(CompanionshipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storiesService: StoriesService,
    private readonly notifications: NotificationsService,
    private readonly tree: TreeService,
  ) {}

  async supportStory(userId: string, storyId: string): Promise<{ supporting: true; count: number }> {
    const story = await this.storiesService.assertStoryVisible(userId, storyId);
    const character = await this.requireCharacter(userId);

    const existing = await this.prisma.companionship.findFirst({
      where: { characterId: character.id, targetStoryId: storyId },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.companionship
        .create({ data: { characterId: character.id, targetStoryId: storyId } })
        .catch((error) => {
          // P2002 = ya existía (petición concurrente): acompañar dos veces no añade nada.
          if (!this.isUniqueError(error)) throw error;
        });

      // "Estoy contigo" también sigue el relato, pero de forma conservadora:
      // aparece en "Lo que sigo" sin generar notificaciones. Si ya había un
      // seguimiento activo ("Seguir relato") no se toca.
      await this.ensureConservativeStoryFollow(character.id, storyId);

      await this.notifications.createAggregated({
        userId: story.ownerUserId,
        actorUserId: userId,
        actorCharacterId: character.id,
        type: NOTIFICATION_TYPES.COMPANIONSHIP,
        entityType: NOTIFICATION_ENTITY.STORY,
        entityId: storyId,
      });

      // Camino de acompañamiento: una interacción respetuosa da una gota al día.
      await this.tree.award(userId, TreePath.ACCOMPANIMENT, 'companionship_story');
    }

    const count = await this.prisma.companionship.count({ where: { targetStoryId: storyId } });
    await this.track('companionship.created', userId, storyId);
    return { supporting: true, count };
  }

  async unsupportStory(userId: string, storyId: string): Promise<{ supporting: false; count: number }> {
    await this.storiesService.assertStoryVisible(userId, storyId);
    const character = await this.requireCharacter(userId);

    await this.prisma.companionship.deleteMany({
      where: { characterId: character.id, targetStoryId: storyId },
    });

    // El seguimiento conservador que creó el acompañamiento se retira con él. Un
    // seguimiento activo ("Seguir relato") se conserva: son decisiones distintas.
    await this.prisma.follower.deleteMany({
      where: {
        followerId: character.id,
        followingStoryId: storyId,
        notifyLevel: STORY_FOLLOW_LEVEL.CONSERVATIVE,
      },
    });

    const count = await this.prisma.companionship.count({ where: { targetStoryId: storyId } });
    return { supporting: false, count };
  }

  async listSupportedStoryIds(userId: string): Promise<{ storyIds: string[] }> {
    const character = await this.requireCharacter(userId);
    const rows = await this.prisma.companionship.findMany({
      where: { characterId: character.id, targetStoryId: { not: null } },
      select: { targetStoryId: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return {
      storyIds: rows
        .map((row) => row.targetStoryId)
        .filter((storyId): storyId is string => storyId !== null),
    };
  }

  async supportCharacter(userId: string, rawName: string): Promise<{ supporting: true; count: number }> {
    const character = await this.requireCharacter(userId);
    const target = await this.resolveTarget(rawName);

    if (target.id === character.id) {
      throw new BadRequestException('No puedes acompañarte a ti mismo.');
    }

    const existing = await this.prisma.companionship.findFirst({
      where: { characterId: character.id, targetCharacterId: target.id },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.companionship
        .create({ data: { characterId: character.id, targetCharacterId: target.id } })
        .catch((error) => {
          if (!this.isUniqueError(error)) throw error;
        });

      await this.notifications.createAggregated({
        userId: target.userId,
        actorUserId: userId,
        actorCharacterId: character.id,
        type: NOTIFICATION_TYPES.COMPANIONSHIP,
        entityType: NOTIFICATION_ENTITY.CHARACTER,
        entityId: target.id,
      });

      await this.tree.award(userId, TreePath.ACCOMPANIMENT, 'companionship_character');
    }

    const count = await this.prisma.companionship.count({ where: { targetCharacterId: target.id } });
    await this.track('companionship.created', userId);
    return { supporting: true, count };
  }

  async unsupportCharacter(userId: string, rawName: string): Promise<{ supporting: false; count: number }> {
    const character = await this.requireCharacter(userId);
    const target = await this.resolveTarget(rawName);

    await this.prisma.companionship.deleteMany({
      where: { characterId: character.id, targetCharacterId: target.id },
    });

    const count = await this.prisma.companionship.count({ where: { targetCharacterId: target.id } });
    return { supporting: false, count };
  }

  /**
   * Sigue el relato en silencio si aún no se sigue. No degrada un seguimiento
   * activo a conservador: "Seguir relato" siempre gana.
   */
  private async ensureConservativeStoryFollow(characterId: string, storyId: string): Promise<void> {
    const existing = await this.prisma.follower.findFirst({
      where: { followerId: characterId, followingStoryId: storyId },
      select: { id: true },
    });
    if (existing) {
      return;
    }

    await this.prisma.follower
      .create({
        data: {
          followerId: characterId,
          followingStoryId: storyId,
          notifyLevel: STORY_FOLLOW_LEVEL.CONSERVATIVE,
        },
      })
      .catch((error) => {
        if (!this.isUniqueError(error)) throw error;
      });
  }

  private async requireCharacter(userId: string): Promise<{ id: string }> {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      throw new ForbiddenException('Necesitas crear tu personaje para acompañar.');
    }

    return character;
  }

  private async resolveTarget(rawName: string): Promise<{ id: string; userId: string }> {
    const name = normalizeCharacterName(rawName);
    if (!name || name.length > 30) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    const rows = await this.prisma.$queryRaw<{ id: string; userId: string }[]>`
      SELECT "id", "userId" FROM "characters" WHERE lower("name") = lower(${name}) LIMIT 1
    `;
    const target = rows[0];
    if (!target) {
      throw new NotFoundException('Personaje no encontrado.');
    }
    return target;
  }

  private isUniqueError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private async track(eventType: string, userId: string, storyId?: string): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: { eventType, userId, entityType: 'companionship', entityId: storyId ?? null },
      });
    } catch (error) {
      this.logger.warn(`No se pudo registrar ${eventType}: ${(error as Error).message}`);
    }
  }
}