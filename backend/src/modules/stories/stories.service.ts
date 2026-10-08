import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StoryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaService } from '../../common/quota/quota.service';
import { env } from '../../config/env';
import {
  CreateStoryDto,
  CreateStoryUpdateDto,
  ListMyStoriesQueryDto,
  ListPublicStoriesQueryDto,
  UpdateStoryDto,
  UpdateStoryUpdateDto,
  type VisibilityValue,
} from './dto/story.dto';
import {
  STORY_TITLE_MAX_LENGTH,
  sanitizeStoryContent,
  sanitizeStoryTitle,
} from './story-sanitize';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

// Estados sobre los que el propietario todavía puede escribir. HIDDEN, REPORTED
// y MODERATED son decisiones de moderación: no se pisan desde aquí.
const EDITABLE_STATUSES: StoryStatus[] = [StoryStatus.DRAFT, StoryStatus.PUBLISHED];

interface StoryScope {
  id: string;
  characterId: string;
  status: StoryStatus;
  visibility: string;
}

const STAGE_SELECT = {
  id: true,
  content: true,
  mediaAssetId: true,
  audioAssetId: true,
  stageOrder: true,
  createdAt: true,
  mediaAsset: { select: { fileUrl: true } },
  audioAsset: { select: { fileUrl: true } },
} satisfies Prisma.StoryUpdateSelect;

type StageRow = {
  id: string;
  content: string;
  mediaAssetId: string | null;
  audioAssetId: string | null;
  stageOrder: number;
  createdAt: Date;
  mediaAsset?: { fileUrl: string } | null;
  audioAsset?: { fileUrl: string } | null;
};

const STORY_DETAIL_SELECT = {
  id: true,
  title: true,
  visibility: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  character: { select: { name: true, avatarUrl: true } },
  categories: { select: { category: { select: { name: true } } } },
  emotions: { select: { emotion: { select: { name: true, colorHex: true } } } },
  tags: { select: { tag: { select: { name: true } } } },
  updates: { orderBy: { stageOrder: 'asc' }, select: STAGE_SELECT },
  _count: { select: { comments: true, companionships: true, followers: true } },
} satisfies Prisma.StorySelect;

const STORY_LIST_SELECT = {
  id: true,
  title: true,
  visibility: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  categories: { select: { category: { select: { name: true } } } },
  emotions: { select: { emotion: { select: { name: true, colorHex: true } } } },
  tags: { select: { tag: { select: { name: true } } } },
  updates: { orderBy: { stageOrder: 'asc' }, take: 1, select: STAGE_SELECT },
  _count: { select: { updates: true, comments: true, companionships: true } },
} satisfies Prisma.StorySelect;

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
  ) {}

  // --- Escritura (propietario) ---------------------------------------------

  async create(userId: string, dto: CreateStoryDto) {
    const characterId = await this.requireCharacterId(userId);

    const title = sanitizeStoryTitle(dto.title);
    const content = sanitizeStoryContent(dto.content);
    this.assertTitleAndContent(title, content);
    this.assertTaxonomyLimits(dto);

    await this.consumeQuota(`story-create:${userId}`, env.stories.createsPerHour, 'publicar relatos');

    const live = await this.prisma.story.count({
      where: { characterId, status: { not: StoryStatus.DELETED } },
    });
    if (live >= env.stories.maxPerCharacter) {
      throw new ConflictException(
        `Has alcanzado el máximo de ${env.stories.maxPerCharacter} relatos. Elimina alguno para publicar otro.`,
      );
    }

    const categoryIds = (await this.resolveCatalog('category', dto.categories)) ?? [];
    const emotionIds = (await this.resolveCatalog('emotion', dto.emotions)) ?? [];
    const tagIds = (await this.resolveCatalog('tag', dto.tags)) ?? [];
    const mediaAssetId = await this.assertMediaUsable(userId, dto.mediaAssetId);
    const audioAssetId = await this.assertMediaUsable(userId, dto.audioAssetId);

    const status = dto.publish ? StoryStatus.PUBLISHED : StoryStatus.DRAFT;

    const story = await this.prisma.$transaction(async (tx) => {
      const created = await tx.story.create({
        data: {
          characterId,
          title,
          visibility: (dto.visibility ?? 'PUBLIC') as VisibilityValue,
          status,
          updates: { create: { content, mediaAssetId, audioAssetId, stageOrder: 1 } },
          categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
          emotions: { create: emotionIds.map((emotionId) => ({ emotionId })) },
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
        },
        select: STORY_DETAIL_SELECT,
      });

      if (mediaAssetId) {
        await this.markMediaAttached(tx, mediaAssetId, created.id);
      }
      if (audioAssetId) {
        await this.markMediaAttached(tx, audioAssetId, created.id);
      }

      return created;
    });

    await this.track(status === StoryStatus.PUBLISHED ? 'story.published' : 'story.created', {
      userId,
      characterId,
      storyId: story.id,
    });

    return this.toOwnerView(story);
  }

  async update(userId: string, storyId: string, dto: UpdateStoryDto) {
    const story = await this.findOwnedStory(userId, storyId);
    this.assertEditable(story.status);
    this.assertTaxonomyLimits(dto);

    const title = dto.title === undefined ? undefined : sanitizeStoryTitle(dto.title);
    if (title !== undefined && title.length < 3) {
      throw new BadRequestException(`El título debe tener al menos 3 caracteres.`);
    }

    const categoryIds = await this.resolveCatalog('category', dto.categories);
    const emotionIds = await this.resolveCatalog('emotion', dto.emotions);
    const tagIds = await this.resolveCatalog('tag', dto.tags);

    if (
      title === undefined &&
      dto.visibility === undefined &&
      categoryIds === undefined &&
      emotionIds === undefined &&
      tagIds === undefined
    ) {
      throw new BadRequestException('No hay cambios que guardar.');
    }

    await this.consumeQuota(`story-edit:${userId}`, env.stories.editsPerHour, 'editar relatos');

    const updated = await this.prisma.$transaction(async (tx) => {
      if (categoryIds !== undefined) {
        await tx.storyCategory.deleteMany({ where: { storyId } });
        if (categoryIds.length > 0) {
          await tx.storyCategory.createMany({
            data: categoryIds.map((categoryId) => ({ storyId, categoryId })),
            skipDuplicates: true,
          });
        }
      }
      if (emotionIds !== undefined) {
        await tx.storyEmotion.deleteMany({ where: { storyId } });
        if (emotionIds.length > 0) {
          await tx.storyEmotion.createMany({
            data: emotionIds.map((emotionId) => ({ storyId, emotionId })),
            skipDuplicates: true,
          });
        }
      }
      if (tagIds !== undefined) {
        await tx.storyTag.deleteMany({ where: { storyId } });
        if (tagIds.length > 0) {
          await tx.storyTag.createMany({
            data: tagIds.map((tagId) => ({ storyId, tagId })),
            skipDuplicates: true,
          });
        }
      }

      return tx.story.update({
        where: { id: storyId },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
          updatedAt: new Date(),
        },
        select: STORY_DETAIL_SELECT,
      });
    });

    return this.toOwnerView(updated);
  }

  async addUpdate(userId: string, storyId: string, dto: CreateStoryUpdateDto) {
    const story = await this.findOwnedStory(userId, storyId);
    this.assertEditable(story.status);

    const content = sanitizeStoryContent(dto.content);
    if (!content) {
      throw new BadRequestException('La etapa no puede estar vacía.');
    }

    await this.consumeQuota(`story-update:${userId}`, env.stories.updatesPerHour, 'publicar etapas');

    const stageCount = await this.prisma.storyUpdate.count({ where: { storyId } });
    if (stageCount >= env.stories.maxUpdatesPerStory) {
      throw new ConflictException(
        `Este relato ha alcanzado el máximo de ${env.stories.maxUpdatesPerStory} etapas.`,
      );
    }

    const mediaAssetId = await this.assertMediaUsable(userId, dto.mediaAssetId);
    const audioAssetId = await this.assertMediaUsable(userId, dto.audioAssetId);

    const stage = await this.prisma.$transaction(async (tx) => {
      const aggregate = await tx.storyUpdate.aggregate({
        where: { storyId },
        _max: { stageOrder: true },
      });
      const stageOrder = (aggregate._max.stageOrder ?? 0) + 1;

      const created = await tx.storyUpdate.create({
        data: { storyId, content, mediaAssetId, audioAssetId, stageOrder },
        select: STAGE_SELECT,
      });

      if (mediaAssetId) {
        await this.markMediaAttached(tx, mediaAssetId, storyId);
      }
      if (audioAssetId) {
        await this.markMediaAttached(tx, audioAssetId, storyId);
      }

      await tx.story.update({ where: { id: storyId }, data: { updatedAt: new Date() } });
      return created;
    });

    await this.track('story.update.added', {
      userId,
      characterId: story.characterId,
      storyId,
    });

    return this.toStageView(stage);
  }

  async updateStage(
    userId: string,
    storyId: string,
    updateId: string,
    dto: UpdateStoryUpdateDto,
  ) {
    const story = await this.findOwnedStory(userId, storyId);
    this.assertEditable(story.status);

    const stage = await this.prisma.storyUpdate.findFirst({
      where: { id: updateId, storyId },
      select: { id: true, mediaAssetId: true, audioAssetId: true },
    });
    if (!stage) {
      throw new NotFoundException('Esa etapa no existe en el relato.');
    }

    const content = dto.content === undefined ? undefined : sanitizeStoryContent(dto.content);
    if (content !== undefined && !content) {
      throw new BadRequestException('La etapa no puede estar vacía.');
    }

    let nextMediaId: string | null | undefined = undefined;
    if (dto.mediaAssetId !== undefined) {
      nextMediaId = dto.mediaAssetId === null ? null : await this.assertMediaUsable(userId, dto.mediaAssetId);
    }
    let nextAudioId: string | null | undefined = undefined;
    if (dto.audioAssetId !== undefined) {
      nextAudioId = dto.audioAssetId === null ? null : await this.assertMediaUsable(userId, dto.audioAssetId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.storyUpdate.update({
        where: { id: updateId },
        data: {
          ...(content !== undefined ? { content } : {}),
          ...(nextMediaId !== undefined ? { mediaAssetId: nextMediaId } : {}),
          ...(nextAudioId !== undefined ? { audioAssetId: nextAudioId } : {}),
        },
        select: STAGE_SELECT,
      });

      // Se libera el archivo anterior y se marca el nuevo dentro de la misma
      // transacción, para que no queden adjuntos a medias.
      await this.reconcileAttachment(tx, storyId, stage.mediaAssetId, nextMediaId);
      await this.reconcileAttachment(tx, storyId, stage.audioAssetId, nextAudioId);

      await tx.story.update({ where: { id: storyId }, data: { updatedAt: new Date() } });
      return result;
    });

    return this.toStageView(updated);
  }

  /**
   * Ajusta el marcador de un archivo adjunto cuando una etapa cambia de imagen
   * o de audio: libera el anterior y marca el nuevo como en uso. `undefined`
   * en `nextId` significa "no tocar".
   */
  private async reconcileAttachment(
    tx: Prisma.TransactionClient,
    storyId: string,
    currentId: string | null,
    nextId: string | null | undefined,
  ): Promise<void> {
    if (nextId === undefined || nextId === currentId) {
      return;
    }
    if (currentId) {
      await tx.mediaAsset.update({
        where: { id: currentId },
        data: { entityType: 'NONE', entityId: null },
      });
    }
    if (nextId) {
      await this.markMediaAttached(tx, nextId, storyId);
    }
  }

  async removeStage(userId: string, storyId: string, updateId: string) {
    const story = await this.findOwnedStory(userId, storyId);
    this.assertEditable(story.status);

    const stage = await this.prisma.storyUpdate.findFirst({
      where: { id: updateId, storyId },
      select: { id: true, mediaAssetId: true },
    });
    if (!stage) {
      throw new NotFoundException('Esa etapa no existe en el relato.');
    }

    const total = await this.prisma.storyUpdate.count({ where: { storyId } });
    if (total <= 1) {
      throw new BadRequestException('El relato debe conservar al menos una etapa.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.storyUpdate.delete({ where: { id: updateId } });
      if (stage.mediaAssetId) {
        await tx.mediaAsset.update({
          where: { id: stage.mediaAssetId },
          data: { entityType: 'NONE', entityId: null },
        });
      }
      await tx.story.update({ where: { id: storyId }, data: { updatedAt: new Date() } });
    });

    return { id: updateId };
  }

  async publish(userId: string, storyId: string) {
    const story = await this.findOwnedStory(userId, storyId);

    if (story.status === StoryStatus.PUBLISHED) {
      return this.getOwnedDetail(userId, storyId);
    }
    if (story.status !== StoryStatus.DRAFT) {
      throw new ConflictException('Este relato no se puede publicar en su estado actual.');
    }

    await this.prisma.story.update({
      where: { id: storyId },
      data: { status: StoryStatus.PUBLISHED, updatedAt: new Date() },
    });

    await this.track('story.published', {
      userId,
      characterId: story.characterId,
      storyId,
    });

    return this.getOwnedDetail(userId, storyId);
  }

  async unpublish(userId: string, storyId: string) {
    const story = await this.findOwnedStory(userId, storyId);

    if (story.status !== StoryStatus.PUBLISHED) {
      throw new ConflictException('Solo se puede volver a borrador un relato publicado.');
    }

    await this.prisma.story.update({
      where: { id: storyId },
      data: { status: StoryStatus.DRAFT, updatedAt: new Date() },
    });

    return this.getOwnedDetail(userId, storyId);
  }

  /**
   * Baja lógica: el relato deja de mostrarse y de poder editarse, pero la fila
   * se conserva para moderación y para no romper interacciones existentes. Se
   * liberan los archivos adjuntos para que la biblioteca no quede bloqueada.
   */
  async remove(userId: string, storyId: string) {
    // La comprobación de propiedad lanza 404 si el relato no es del usuario.
    await this.findOwnedStory(userId, storyId);

    await this.prisma.$transaction(async (tx) => {
      const attached = await tx.storyUpdate.findMany({
        where: {
          storyId,
          OR: [{ mediaAssetId: { not: null } }, { audioAssetId: { not: null } }],
        },
        select: { mediaAssetId: true, audioAssetId: true },
      });

      await tx.storyUpdate.updateMany({
        where: { storyId },
        data: { mediaAssetId: null, audioAssetId: null },
      });

      const assetIds = attached
        .flatMap((row) => [row.mediaAssetId, row.audioAssetId])
        .filter((id): id is string => Boolean(id));
      if (assetIds.length > 0) {
        await tx.mediaAsset.updateMany({
          where: { id: { in: assetIds } },
          data: { entityType: 'NONE', entityId: null },
        });
      }

      await tx.story.update({
        where: { id: storyId },
        data: { status: StoryStatus.DELETED, updatedAt: new Date() },
      });
    });

    return { id: storyId };
  }

  // --- Lectura (propietario) -----------------------------------------------

  async listMine(userId: string, query: ListMyStoriesQueryDto) {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    // Sin personaje no hay relatos: se devuelve una lista vacía en lugar de un
    // error, porque entrar a "mis relatos" antes de crear el personaje es normal.
    if (!character) {
      return { items: [], nextCursor: null };
    }

    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.story.findMany({
      where: {
        characterId: character.id,
        ...(query.status ? { status: query.status } : { status: { not: StoryStatus.DELETED } }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: STORY_LIST_SELECT,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items: items.map((row) => this.toOwnerListView(row)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async getOwnedDetail(userId: string, storyId: string) {
    await this.findOwnedStory(userId, storyId);

    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: STORY_DETAIL_SELECT,
    });

    if (!story) {
      throw new NotFoundException('Ese relato no existe.');
    }

    return this.toOwnerView(story);
  }

  // --- Lectura (pública) ---------------------------------------------------

  async listPublic(query: ListPublicStoriesQueryDto) {
    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.story.findMany({
      where: {
        status: StoryStatus.PUBLISHED,
        visibility: 'PUBLIC',
        ...(query.category ? { categories: { some: { category: { name: { equals: query.category, mode: 'insensitive' } } } } } : {}),
        ...(query.emotion ? { emotions: { some: { emotion: { name: { equals: query.emotion, mode: 'insensitive' } } } } } : {}),
        ...(query.tag ? { tags: { some: { tag: { name: { equals: query.tag, mode: 'insensitive' } } } } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: STORY_LIST_SELECT_WITH_AUTHOR,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items: items.map((row) => this.toPublicListView(row)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async getPublic(storyId: string) {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, status: StoryStatus.PUBLISHED, visibility: 'PUBLIC' },
      select: STORY_DETAIL_SELECT,
    });

    if (!story) {
      throw new NotFoundException('Ese relato no existe o no es público.');
    }

    // La lectura no espera a la analítica: es la ruta más visitada y no debe
    // pagar la latencia de una escritura por cada vista. `track` ya traga sus
    // propios errores.
    void this.track('story.viewed', { storyId });

    return this.toPublicView(story);
  }

  /**
   * Detalle autenticado: aplica la visibilidad. El propietario ve cualquier
   * relato suyo (borrador incluido); quien sigue al autor ve PUBLIC y FOLLOWERS;
   * el resto solo PUBLIC. Un relato que no se puede ver responde 404, igual que
   * uno inexistente, para no revelar que existe.
   */
  async getViewable(userId: string, storyId: string) {
    const scope = await this.prisma.story.findFirst({
      where: { id: storyId, status: { not: StoryStatus.DELETED } },
      select: {
        id: true,
        status: true,
        visibility: true,
        characterId: true,
        character: { select: { userId: true } },
      },
    });

    if (!scope) {
      throw new NotFoundException('Ese relato no existe o no es visible para ti.');
    }

    const isOwner = scope.character.userId === userId;

    if (!isOwner) {
      if (scope.status !== StoryStatus.PUBLISHED) {
        throw new NotFoundException('Ese relato no existe o no es visible para ti.');
      }
      if (scope.visibility === 'PRIVATE') {
        throw new NotFoundException('Ese relato no existe o no es visible para ti.');
      }
      if (scope.visibility === 'FOLLOWERS') {
        const following = await this.prisma.follower.count({
          where: {
            follower: { userId },
            followingCharacterId: scope.characterId,
          },
        });
        if (following === 0) {
          throw new NotFoundException('Ese relato no existe o no es visible para ti.');
        }
      }
    }

    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: STORY_DETAIL_SELECT,
    });
    if (!story) {
      throw new NotFoundException('Ese relato no existe o no es visible para ti.');
    }

    return isOwner ? this.toOwnerView(story) : this.toPublicView(story);
  }

  /**
   * Feed de los personajes que sigue el usuario. Incluye relatos PUBLIC y
   * FOLLOWERS publicados por quienes sigue. Sin personaje o sin seguimientos
   * devuelve una lista vacía en vez de un error.
   */
  async listFollowing(userId: string, query: ListPublicStoriesQueryDto) {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      return { items: [], nextCursor: null };
    }

    const follows = await this.prisma.follower.findMany({
      where: { followerId: character.id, followingCharacterId: { not: null } },
      select: { followingCharacterId: true },
    });

    const followedIds = [
      ...new Set(
        follows
          .map((row) => row.followingCharacterId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];

    if (followedIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.story.findMany({
      where: {
        characterId: { in: followedIds },
        status: StoryStatus.PUBLISHED,
        visibility: { in: ['PUBLIC', 'FOLLOWERS'] },
        ...(query.category
          ? { categories: { some: { category: { name: { equals: query.category, mode: 'insensitive' } } } } }
          : {}),
        ...(query.emotion
          ? { emotions: { some: { emotion: { name: { equals: query.emotion, mode: 'insensitive' } } } } }
          : {}),
        ...(query.tag
          ? { tags: { some: { tag: { name: { equals: query.tag, mode: 'insensitive' } } } } }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: STORY_LIST_SELECT_WITH_AUTHOR,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items: items.map((row) => this.toPublicListView(row)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  // --- Apoyo ----------------------------------------------------------------

  private async requireCharacterId(userId: string): Promise<string> {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      throw new ForbiddenException('Necesitas crear tu personaje antes de publicar relatos.');
    }

    return character.id;
  }

  private async findOwnedStory(userId: string, storyId: string): Promise<StoryScope> {
    const story = await this.prisma.story.findFirst({
      where: {
        id: storyId,
        character: { userId },
        status: { not: StoryStatus.DELETED },
      },
      select: { id: true, characterId: true, status: true, visibility: true },
    });

    if (!story) {
      throw new NotFoundException('Ese relato no existe.');
    }

    return story;
  }

  private assertEditable(status: StoryStatus): void {
    if (!EDITABLE_STATUSES.includes(status)) {
      throw new ConflictException('Este relato no se puede editar en su estado actual.');
    }
  }

  private assertTitleAndContent(title: string, content: string): void {
    if (title.length < 3 || title.length > STORY_TITLE_MAX_LENGTH) {
      throw new BadRequestException('El título debe tener entre 3 y 120 caracteres.');
    }
    if (!content) {
      throw new BadRequestException('El relato no puede estar vacío.');
    }
  }

  private assertTaxonomyLimits(dto: {
    categories?: string[];
    emotions?: string[];
    tags?: string[];
  }): void {
    if (dto.categories && dto.categories.length > 3) {
      throw new BadRequestException('Elige como máximo 3 categorías.');
    }
    if (dto.emotions && dto.emotions.length > 5) {
      throw new BadRequestException('Elige como máximo 5 emociones.');
    }
    if (dto.tags && dto.tags.length > 10) {
      throw new BadRequestException('Elige como máximo 10 etiquetas.');
    }
  }

  /**
   * Traduce nombres de catálogo a identificadores. Un nombre fuera del catálogo
   * se rechaza entero: el cliente no puede crear entradas nuevas ni colgar
   * identificadores inventados. `undefined` significa "no tocar" en una
   * actualización; `[]` significa "vaciar".
   */
  private async resolveCatalog(
    model: 'category' | 'emotion' | 'tag',
    names: string[] | undefined,
  ): Promise<string[] | undefined> {
    if (names === undefined) {
      return undefined;
    }
    if (names.length === 0) {
      return [];
    }

    const rows = await (
      this.prisma[model] as unknown as {
        findMany: (args: unknown) => Promise<{ id: string; name: string }[]>;
      }
    ).findMany({
      where: { name: { in: names, mode: 'insensitive' } },
      select: { id: true, name: true },
    });

    if (rows.length !== names.length) {
      const known = new Set(rows.map((row) => row.name.toLowerCase()));
      const unknown = names.filter((name) => !known.has(name.toLowerCase()));
      throw new BadRequestException(
        `Valor no válido en el catálogo: ${unknown.join(', ')}. Elige entre las opciones disponibles.`,
      );
    }

    return rows.map((row) => row.id);
  }

  /**
   * Un archivo solo se puede adjuntar si pertenece a quien escribe y todavía no
   * está en uso. Así nadie adjunta medios de otra persona ni roba un archivo ya
   * vinculado a otro relato.
   */
  private async assertMediaUsable(userId: string, assetId?: string): Promise<string | null> {
    if (!assetId) {
      return null;
    }

    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, userId },
      select: { id: true, entityType: true },
    });

    if (!asset) {
      throw new BadRequestException('El archivo indicado no existe en tu biblioteca.');
    }
    if (asset.entityType !== 'NONE') {
      throw new ConflictException('Ese archivo ya está en uso en otro contenido.');
    }

    return asset.id;
  }

  private async markMediaAttached(
    tx: Prisma.TransactionClient,
    assetId: string,
    storyId: string,
  ): Promise<void> {
    await tx.mediaAsset.update({
      where: { id: assetId },
      data: { entityType: 'STORY_MEDIA', entityId: storyId },
    });
  }

  private async consumeQuota(key: string, limit: number, action: string): Promise<void> {
    const result = await this.quota.consume(key, limit, 60 * 60_000);

    if (!result.allowed) {
      throw new HttpException(
        `Has alcanzado el límite de ${limit} ${action} por hora. Inténtalo en ${result.retryAfterSeconds} s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async track(
    eventType: string,
    data: { userId?: string; characterId?: string; storyId: string },
  ): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          eventType,
          userId: data.userId ?? null,
          characterId: data.characterId ?? null,
          entityType: 'story',
          entityId: data.storyId,
        },
      });
    } catch (error) {
      // La analítica nunca debe bloquear la escritura del relato.
      this.logger.warn(`No se pudo registrar el evento ${eventType}: ${(error as Error).message}`);
    }
  }

  // --- Vistas ---------------------------------------------------------------

  private toStageView(stage: StageRow) {
    return {
      id: stage.id,
      content: stage.content,
      mediaUrl: stage.mediaAsset?.fileUrl ?? null,
      audioUrl: stage.audioAsset?.fileUrl ?? null,
      stageOrder: stage.stageOrder,
      createdAt: stage.createdAt,
    };
  }

  private toOwnerView(story: {
    id: string;
    title: string;
    visibility: string;
    status: StoryStatus;
    createdAt: Date;
    updatedAt: Date;
    character?: { name: string; avatarUrl: string | null } | null;
    categories: { category: { name: string } }[];
    emotions: { emotion: { name: string; colorHex: string | null } }[];
    tags: { tag: { name: string } }[];
    updates: StageRow[];
    _count: { comments: number; companionships: number; followers: number };
  }) {
    return {
      id: story.id,
      title: story.title,
      visibility: story.visibility,
      status: story.status,
      author: story.character
        ? { name: story.character.name, avatarUrl: story.character.avatarUrl }
        : null,
      categories: story.categories.map(({ category }) => category.name),
      emotions: story.emotions.map(({ emotion }) => ({
        name: emotion.name,
        colorHex: emotion.colorHex,
      })),
      tags: story.tags.map(({ tag }) => tag.name),
      updates: story.updates.map((stage) => this.toStageView(stage)),
      supportCount: story._count.companionships,
      commentCount: story._count.comments,
      followerCount: story._count.followers,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }

  private toOwnerListView(story: {
    id: string;
    title: string;
    visibility: string;
    status: StoryStatus;
    createdAt: Date;
    updatedAt: Date;
    categories: { category: { name: string } }[];
    emotions: { emotion: { name: string; colorHex: string | null } }[];
    tags: { tag: { name: string } }[];
    updates: StageRow[];
    _count: { updates: number; comments: number; companionships: number };
  }) {
    const opening = story.updates[0];
    return {
      id: story.id,
      title: story.title,
      visibility: story.visibility,
      status: story.status,
      categories: story.categories.map(({ category }) => category.name),
      emotions: story.emotions.map(({ emotion }) => ({
        name: emotion.name,
        colorHex: emotion.colorHex,
      })),
      tags: story.tags.map(({ tag }) => tag.name),
      opening: opening ? this.toStageView(opening) : null,
      stageCount: story._count.updates,
      supportCount: story._count.companionships,
      commentCount: story._count.comments,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }

  private toPublicView(story: {
    id: string;
    title: string;
    visibility: string;
    status: StoryStatus;
    createdAt: Date;
    updatedAt: Date;
    character?: { name: string; avatarUrl: string | null } | null;
    categories: { category: { name: string } }[];
    emotions: { emotion: { name: string; colorHex: string | null } }[];
    tags: { tag: { name: string } }[];
    updates: StageRow[];
    _count: { comments: number; companionships: number; followers: number };
  }) {
    return {
      ...this.toOwnerView(story),
      status: 'PUBLISHED' as const,
    };
  }

  private toPublicListView(story: {
    id: string;
    title: string;
    visibility: string;
    createdAt: Date;
    updatedAt: Date;
    character: { name: string; avatarUrl: string | null };
    categories: { category: { name: string } }[];
    emotions: { emotion: { name: string; colorHex: string | null } }[];
    tags: { tag: { name: string } }[];
    updates: StageRow[];
    _count: { updates: number; comments: number; companionships: number };
  }) {
    const opening = story.updates[0];
    return {
      id: story.id,
      title: story.title,
      author: { name: story.character.name, avatarUrl: story.character.avatarUrl },
      categories: story.categories.map(({ category }) => category.name),
      emotions: story.emotions.map(({ emotion }) => ({
        name: emotion.name,
        colorHex: emotion.colorHex,
      })),
      tags: story.tags.map(({ tag }) => tag.name),
      opening: opening ? this.toStageView(opening) : null,
      stageCount: story._count.updates,
      supportCount: story._count.companionships,
      commentCount: story._count.comments,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
    };
  }
}

const STORY_LIST_SELECT_WITH_AUTHOR = {
  ...STORY_LIST_SELECT,
  character: { select: { name: true, avatarUrl: true } },
} satisfies Prisma.StorySelect;
