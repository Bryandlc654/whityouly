import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoriesService } from '../stories/stories.service';

export interface SavedStory {
  id: string;
  title: string;
  visibility: string;
  author: { name: string; avatarUrl: string | null } | null;
  opening: { content: string; mediaUrl: string | null; audioUrl: string | null } | null;
  savedAt: Date;
}

const MAX_SAVED = 200;

/**
 * Guardados privados: los guarda el propietario y nadie los ve. Se guardan por
 * identificador (el modelo no enlaza el relato), así que al listar se enlazan
 * con los relatos vivos; los borrados se omiten.
 */
@Injectable()
export class BookmarksService {
  private readonly logger = new Logger(BookmarksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storiesService: StoriesService,
  ) {}

  async saveStory(userId: string, storyId: string): Promise<{ saved: true }> {
    // Solo se guarda un relato que se puede ver.
    await this.storiesService.assertStoryVisible(userId, storyId);

    const existing = await this.prisma.bookmark.findFirst({
      where: { userId, targetType: 'STORY', targetId: storyId },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.bookmark
        .create({ data: { userId, targetType: 'STORY', targetId: storyId } })
        .catch((error) => {
          if (!this.isUniqueError(error)) throw error;
        });
    }

    return { saved: true };
  }

  async unsaveStory(userId: string, storyId: string): Promise<{ saved: false }> {
    await this.prisma.bookmark.deleteMany({
      where: { userId, targetType: 'STORY', targetId: storyId },
    });

    return { saved: false };
  }

  async listSaved(userId: string): Promise<{ items: SavedStory[] }> {
    if (!(await this.requireUser(userId))) {
      return { items: [] };
    }

    const rows = await this.prisma.bookmark.findMany({
      where: { userId, targetType: 'STORY' },
      orderBy: { createdAt: 'desc' },
      take: MAX_SAVED,
      select: { id: true, targetId: true, createdAt: true },
    });

    if (rows.length === 0) {
      return { items: [] };
    }

    const ids = rows.map((row) => row.targetId);
    const stories = await this.prisma.story.findMany({
      where: { id: { in: ids }, status: { not: 'DELETED' } },
      select: {
        id: true,
        title: true,
        visibility: true,
        character: { select: { name: true, avatarUrl: true } },
        updates: {
          orderBy: { stageOrder: 'asc' },
          take: 1,
          select: {
            id: true,
            content: true,
            mediaAsset: { select: { fileUrl: true } },
            audioAsset: { select: { fileUrl: true } },
          },
        },
      },
    });

    const byId = new Map(stories.map((story) => [story.id, story]));

    const items: SavedStory[] = rows.flatMap((row) => {
      const story = byId.get(row.targetId);
      if (!story) return [];
      const opening = story.updates[0];
      return [
        {
          id: story.id,
          title: story.title,
          visibility: story.visibility,
          author: story.character
            ? { name: story.character.name, avatarUrl: story.character.avatarUrl }
            : null,
          opening: opening
            ? {
                content: opening.content,
                mediaUrl: opening.mediaAsset?.fileUrl ?? null,
                audioUrl: opening.audioAsset?.fileUrl ?? null,
              }
            : null,
          savedAt: row.createdAt,
        },
      ];
    });

    return { items };
  }

  private async requireUser(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    return user !== null;
  }

  private isUniqueError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}