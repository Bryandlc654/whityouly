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
import { NotificationsService } from '../notifications/notifications.service';
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_TYPES,
} from '../notifications/notification-types';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

// Tamaño de cada sección del feed y techo de la piscina de candidatos para la
// recomendación (acotado para que el ranking se calcule sin recorrer la tabla).
const FEED_SECTION_LIMIT = 12;
const RECOMMEND_POOL_SIZE = 60;

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
  featuredAt: true,
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
  featuredAt: true,
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
    private readonly notifications: NotificationsService,
  ) {}

  // --- Escritura (propietario) ---------------------------------------------

  async create(userId: string, dto: CreateStoryDto) {
    const characterId = await this.requireCharacterId(userId);

    const title = sanitizeStoryTitle(dto.title);
    const content = sanitizeStoryContent(dto.content ?? '');
    this.assertTitle(title);
    this.assertStoryHasContent(content, dto.mediaAssetId, dto.audioAssetId);
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

    const content = sanitizeStoryContent(dto.content ?? '');
    this.assertStoryHasContent(content, dto.mediaAssetId, dto.audioAssetId);

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

    await this.notifyStoryFollowers(userId, story.characterId, storyId);

    return this.toStageView(stage);
  }

  /**
   * Avisa a quienes siguen el relato (y no son su autor) de que hay una etapa
   * nueva. Se hace en un solo INSERT por lote: un relato popular puede tener
   * muchos seguidores y no conviene una consulta por cada uno.
   */
  private async notifyStoryFollowers(
    ownerUserId: string,
    characterId: string,
    storyId: string,
  ): Promise<void> {
    const followers = await this.prisma.follower.findMany({
      where: { followingStoryId: storyId, follower: { userId: { not: ownerUserId } } },
      select: { follower: { select: { userId: true } } },
    });

    await this.notifications.createMany(
      followers.map((row) => ({
        userId: row.follower.userId,
        actorUserId: ownerUserId,
        actorCharacterId: characterId,
        type: NOTIFICATION_TYPES.STORY_UPDATE,
        entityType: NOTIFICATION_ENTITY.STORY,
        entityId: storyId,
      })),
    );
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

    let nextMediaId: string | null | undefined = undefined;
    if (dto.mediaAssetId !== undefined) {
      nextMediaId = dto.mediaAssetId === null ? null : await this.assertMediaUsable(userId, dto.mediaAssetId);
    }
    let nextAudioId: string | null | undefined = undefined;
    if (dto.audioAssetId !== undefined) {
      nextAudioId = dto.audioAssetId === null ? null : await this.assertMediaUsable(userId, dto.audioAssetId);
    }

    // Una etapa puede quedar sin texto mientras conserve imagen o audio.
    if (content !== undefined && content === '') {
      const finalMedia = dto.mediaAssetId !== undefined ? nextMediaId : stage.mediaAssetId;
      const finalAudio = dto.audioAssetId !== undefined ? nextAudioId : stage.audioAssetId;
      if (!finalMedia && !finalAudio) {
        throw new BadRequestException('La etapa necesita texto, imagen o audio.');
      }
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

  /** Destaca el relato en el perfil público. Solo relatos publicados. */
  async feature(userId: string, storyId: string) {
    const story = await this.findOwnedStory(userId, storyId);

    if (story.status !== StoryStatus.PUBLISHED) {
      throw new ConflictException('Solo se pueden destacar relatos publicados.');
    }

    await this.prisma.story.update({
      where: { id: storyId },
      data: { featuredAt: new Date() },
    });

    return this.getOwnedDetail(userId, storyId);
  }

  async unfeature(userId: string, storyId: string) {
    await this.findOwnedStory(userId, storyId);

    await this.prisma.story.update({
      where: { id: storyId },
      data: { featuredAt: null },
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
        ...(query.q
          ? { title: { contains: query.q, mode: 'insensitive' } }
          : {}),
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
   * Vista pública de una lista de relatos por id, en el orden recibido. Solo
   * devuelve los que siguen publicados con visibilidad pública; el resto se
   * descarta. Lo usan el contenido destacado y las tendencias, que primero
   * deciden qué relatos mostrar y luego necesitan la misma vista que el feed.
   */
  async listPublicByIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.prisma.story.findMany({
      where: { id: { in: ids }, status: StoryStatus.PUBLISHED, visibility: 'PUBLIC' },
      select: STORY_LIST_SELECT_WITH_AUTHOR,
    });

    const byId = new Map(rows.map((row) => [row.id, row]));

    return ids
      .map((id) => byId.get(id))
      .filter((row): row is StoryListView => Boolean(row))
      .map((row) => this.toPublicListView(row));
  }

  /**
   * Detalle autenticado: aplica la visibilidad. El propietario ve cualquier
   * relato suyo (borrador incluido); quien sigue al autor ve PUBLIC y FOLLOWERS;
   * el resto solo PUBLIC. Un relato que no se puede ver responde 404, igual que
   * uno inexistente, para no revelar que existe.
   */
  async getViewable(userId: string, storyId: string) {
    await this.assertStoryVisible(userId, storyId);

    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: STORY_DETAIL_SELECT,
    });
    if (!story) {
      throw new NotFoundException('Ese relato no existe o no es visible para ti.');
    }

    return this.toOwnerView(story);
  }

  /**
   * Verifica que el usuario puede ver un relato (propietario, seguidor o
   * público) y devuelve lo necesario para interactuar con él (por ejemplo, sus
   * comentarios). Cualquier relato no visible responde 404 para no revelar que
   * existe.
   */
  async assertStoryVisible(
    userId: string,
    storyId: string,
  ): Promise<{ id: string; characterId: string; ownerUserId: string; isOwner: boolean }> {
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

    return { id: scope.id, characterId: scope.characterId, ownerUserId: scope.character.userId, isOwner };
  }

  /**
   * Feed de los personajes que sigue el usuario. Incluye relatos PUBLIC y
   * FOLLOWERS publicados por quienes sigue. Sin personaje o sin seguimientos
   * devuelve una lista vacía en vez de un error.
   */
  async listFollowing(userId: string, query: ListPublicStoriesQueryDto) {
    const followedIds = await this.getFollowedCharacterIds(userId);

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

  /**
   * Feed principal en secciones: recientes, recomendadas, populares y los de
   * personas seguidas. La recomendación es un ranking por contenido: afinidad
   * con los intereses del personaje y con el tema de lo que ya publica el
   * usuario, con un refuerzo para autores seguidos y una base de popularidad y
   * frescura. Si el perfil aún no tiene señales, cae a popularidad + frescura.
   */
  async getFeed(userId: string) {
    const baseWhere = { status: StoryStatus.PUBLISHED, visibility: 'PUBLIC' } as const;

    // El personaje (con sus intereses) se lee una vez y se reutiliza para
    // resolver los seguidos y el perfil, sin consultas duplicadas.
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: {
        id: true,
        interests: { select: { interest: { select: { name: true } } } },
      },
    });
    const followedIds = character
      ? await this.getFollowedCharacterIdsByCharacter(character.id)
      : [];

    const [profile, recentPool, popular, following] = await Promise.all([
      // El perfil también consulta los relatos propios; todo en paralelo.
      this.buildProfile(userId, character, followedIds),
      // Piscina ligera (sin etapas ni medios): con ella se calculan recientes y
      // recomendadas, así que no hace falta una consulta por sección.
      this.prisma.story.findMany({
        where: baseWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: RECOMMEND_POOL_SIZE,
        select: RECOMMEND_SELECT,
      }),
      this.prisma.story.findMany({
        where: baseWhere,
        orderBy: [
          { comments: { _count: 'desc' } },
          { companionships: { _count: 'desc' } },
          { createdAt: 'desc' },
        ],
        take: FEED_SECTION_LIMIT,
        select: STORY_LIST_SELECT_WITH_AUTHOR,
      }),
      followedIds.length > 0
        ? this.prisma.story.findMany({
            where: {
              characterId: { in: followedIds },
              status: StoryStatus.PUBLISHED,
              visibility: { in: ['PUBLIC', 'FOLLOWERS'] },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: FEED_SECTION_LIMIT,
            select: STORY_LIST_SELECT_WITH_AUTHOR,
          })
        : Promise.resolve<StoryListView[]>([]),
    ]);

    // Recientes = cabecera de la piscina; recomendadas = ranking de la misma.
    const recent = recentPool.slice(0, FEED_SECTION_LIMIT);
    const recommended = this.topRecommended(recentPool, profile);

    // Las vistas completas solo se descargan de los relatos que se van a
    // mostrar, y en una única consulta.
    const wanted = new Set<string>([
      ...recent.map((row) => row.id),
      ...recommended.map((row) => row.id),
      ...popular.map((row) => row.id),
      ...following.map((row) => row.id),
    ]);
    const fullRows = await this.prisma.story.findMany({
      where: { id: { in: [...wanted] } },
      select: STORY_LIST_SELECT_WITH_AUTHOR,
    });
    const fullById = new Map(fullRows.map((row) => [row.id, row]));
    const asFull = (id: string) => fullById.get(id) as StoryListView;

    return {
      recent: recent.map((row) => this.toPublicListView(asFull(row.id))),
      recommended: recommended.map((row) => this.toPublicListView(asFull(row.id))),
      popular: popular.map((row) => this.toPublicListView(row)),
      following: following.map((row) => this.toPublicListView(row)),
    };
  }

  // --- Apoyo ----------------------------------------------------------------

  /** Ids (sin repetir) de los personajes que sigue ese personaje concreto. */
  private async getFollowedCharacterIdsByCharacter(characterId: string): Promise<string[]> {
    const follows = await this.prisma.follower.findMany({
      where: { followerId: characterId, followingCharacterId: { not: null } },
      select: { followingCharacterId: true },
    });

    return [
      ...new Set(
        follows
          .map((row) => row.followingCharacterId)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
  }

  /** Ids (sin repetir) de los personajes que sigue el usuario. Vacío si no tiene. */
  private async getFollowedCharacterIds(userId: string): Promise<string[]> {
    const character = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      return [];
    }

    return this.getFollowedCharacterIdsByCharacter(character.id);
  }

  /** Ordena la piscina por puntuación y devuelve el mejor tramo. */
  private topRecommended(pool: FeedRow[], profile: UserProfile): FeedRow[] {
    return [...pool]
      .sort(
        (a, b) =>
          this.scoreStory(b, profile) - this.scoreStory(a, profile) ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .slice(0, FEED_SECTION_LIMIT);
  }

  /**
   * Perfil de preferencias del usuario para la recomendación: sus intereses
   * declarados, la temática de lo que ya publica y a quién sigue. Recibe el
   * personaje y los seguidos ya resueltos para no repetir consultas en el feed.
   */
  private async buildProfile(
    userId: string,
    character: { id: string; interests: { interest: { name: string } }[] } | null,
    followedIds: string[],
  ): Promise<UserProfile> {
    const profile: UserProfile = {
      interests: new Set<string>(),
      authoredTags: new Map<string, number>(),
      authoredCategories: new Map<string, number>(),
      authoredEmotions: new Map<string, number>(),
      followedIds: new Set(followedIds),
    };

    for (const { interest } of character?.interests ?? []) {
      profile.interests.add(interest.name.toLowerCase());
    }

    if (!character) {
      return profile;
    }

    const authored = await this.prisma.story.findMany({
      where: { character: { userId }, status: StoryStatus.PUBLISHED },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        categories: { select: { category: { select: { name: true } } } },
        emotions: { select: { emotion: { select: { name: true } } } },
        tags: { select: { tag: { select: { name: true } } } },
      },
    });

    for (const story of authored) {
      story.categories.forEach(({ category }) =>
        profile.authoredCategories.set(category.name.toLowerCase(), (profile.authoredCategories.get(category.name.toLowerCase()) ?? 0) + 1),
      );
      story.emotions.forEach(({ emotion }) =>
        profile.authoredEmotions.set(emotion.name.toLowerCase(), (profile.authoredEmotions.get(emotion.name.toLowerCase()) ?? 0) + 1),
      );
      story.tags.forEach(({ tag }) =>
        profile.authoredTags.set(tag.name.toLowerCase(), (profile.authoredTags.get(tag.name.toLowerCase()) ?? 0) + 1),
      );
    }

    return profile;
  }

  /**
   * Puntuación de una historia frente al perfil. Separada del perfil para
   * poder ajustarla sin tocar las consultas.
   */
  private scoreStory(row: FeedRow, profile: UserProfile): number {
    const tags = row.tags.map(({ tag }) => tag.name.toLowerCase());
    const categories = row.categories.map(({ category }) => category.name.toLowerCase());
    const emotions = row.emotions.map(({ emotion }) => emotion.name.toLowerCase());

    const hasSignal =
      profile.interests.size > 0 ||
      profile.authoredTags.size > 0 ||
      profile.authoredCategories.size > 0 ||
      profile.authoredEmotions.size > 0;

    // Sin señales (usuario nuevo): mejor popularidad + frescura que nada.
    if (!hasSignal) {
      return this.popularity(row) * 0.65 + this.recency(row) * 0.35;
    }

    let score = 0;

    // 1) Intereses declarados del personaje frente a las etiquetas del relato.
    for (const tag of tags) {
      if (profile.interests.has(tag)) score += 55;
    }

    // 2) Temática propia: etiquetas, categorías y emociones que el usuario ya
    //    usa en sus relatos. La categoría pesa más (agrupa el tema), luego la
    //    emoción (es el tono) y luego la etiqueta (el detalle).
    for (const tag of tags) {
      score += Math.min(profile.authoredTags.get(tag) ?? 0, 5) * 7;
    }
    for (const category of categories) {
      score += Math.min(profile.authoredCategories.get(category) ?? 0, 5) * 9;
    }
    for (const emotion of emotions) {
      score += Math.min(profile.authoredEmotions.get(emotion) ?? 0, 5) * 8;
    }

    // 3) Autor seguido: refuerzo para cerrar el circuito de comunidad.
    if (profile.followedIds.has(row.characterId)) score += 30;

    // 4) Base de popularidad y frescura, acotada para no dominar el ranking.
    score += this.popularity(row) * 25;
    score += this.recency(row) * 12;

    return score;
  }

  /** Popularidad normalizada (log): acompañamientos y comentarios. */
  private popularity(row: FeedRow): number {
    const count = row._count.companionships + row._count.comments;
    return count > 0 ? Math.min(1, Math.log1p(count) / Math.log1p(80)) : 0;
  }

  /** Frescura: 1 = recién publicado, cae a 0 en una semana. */
  private recency(row: FeedRow): number {
    const hours = (Date.now() - row.createdAt.getTime()) / 3_600_000;
    return Math.max(0, 1 - hours / 168);
  }

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

  private assertTitle(title: string): void {
    if (title.length < 3 || title.length > STORY_TITLE_MAX_LENGTH) {
      throw new BadRequestException('El título debe tener entre 3 y 120 caracteres.');
    }
  }

  /** Un relato necesita al menos uno de: texto, imagen o audio. */
  private assertStoryHasContent(
    content: string,
    mediaAssetId?: string | null,
    audioAssetId?: string | null,
  ): void {
    if (content.trim() === '' && !mediaAssetId && !audioAssetId) {
      throw new BadRequestException('El relato necesita texto, imagen o audio.');
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
    featuredAt?: Date | null;
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
      featuredAt: story.featuredAt ?? null,
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
    featuredAt?: Date | null;
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
      featuredAt: story.featuredAt ?? null,
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
  // `characterId` alimenta la recomendación (afinidad con autores seguidos) sin
  // exponerse en la respuesta: los mappers la ignoran.
  characterId: true,
  character: { select: { name: true, avatarUrl: true } },
} satisfies Prisma.StorySelect;

/** Vista completa de una fila del feed (para mostrarla). */
type StoryListView = Prisma.StoryGetPayload<{ select: typeof STORY_LIST_SELECT_WITH_AUTHOR }>;

/**
 * Selección ligera para ranquear candidatos en el feed: basta con las etiquetas,
 * categorías, emociones, el autor y los contadores. No arrastra etapas ni
 * archivos, que es lo que encarece la proyección de la vista completa.
 */
const RECOMMEND_SELECT = {
  id: true,
  characterId: true,
  createdAt: true,
  categories: { select: { category: { select: { name: true } } } },
  emotions: { select: { emotion: { select: { name: true } } } },
  tags: { select: { tag: { select: { name: true } } } },
  _count: { select: { comments: true, companionships: true } },
} satisfies Prisma.StorySelect;

/** Fila ligera para el ranking de recomendación. */
type FeedRow = Prisma.StoryGetPayload<{ select: typeof RECOMMEND_SELECT }>;

/** Preferencias del usuario para la recomendación por contenido. */
interface UserProfile {
  interests: Set<string>;
  authoredTags: Map<string, number>;
  authoredCategories: Map<string, number>;
  authoredEmotions: Map<string, number>;
  followedIds: Set<string>;
}
