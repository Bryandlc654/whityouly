import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoriesService } from '../stories/stories.service';
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
  ) {}

  async supportStory(userId: string, storyId: string): Promise<{ supporting: true; count: number }> {
    await this.storiesService.assertStoryVisible(userId, storyId);
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

    const count = await this.prisma.companionship.count({ where: { targetStoryId: storyId } });
    return { supporting: false, count };
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

  private async resolveTarget(rawName: string): Promise<{ id: string }> {
    const name = normalizeCharacterName(rawName);
    if (!name || name.length > 30) {
      throw new NotFoundException('Personaje no encontrado.');
    }

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "characters" WHERE lower("name") = lower(${name}) LIMIT 1
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