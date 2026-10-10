import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoriesService } from '../stories/stories.service';
import { env } from '../../config/env';
import { UpsertFeaturedDto } from './dto/discovery.dto';

const MAX_SECTION = 30;

export interface RecommendedCharacter {
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
  interests: string[];
  stories: number;
  followers: number;
  /** Cuántos intereses comparte con quien pide la recomendación. */
  sharedInterests: number;
}

export interface CuratedFeaturedEntry {
  storyId: string;
  title: string;
  status: string;
  visibility: string;
  author: string;
  position: number;
  note: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

interface SupportRow {
  targetStoryId: string | null;
  _count: { _all: number };
}

interface CommentRow {
  storyId: string;
  _count: { _all: number };
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  inFlight: Promise<T> | null;
}

/**
 * Descubrimiento del contenido: destacados editoriales, tendencias recientes y
 * personajes recomendados. Reutiliza `StoriesService.listPublicByIds` para
 * devolver exactamente la misma vista que el feed.
 */
@Injectable()
export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storiesService: StoriesService,
  ) {}

  // --- Caché en memoria -----------------------------------------------------
  //
  // El descubrimiento agrega datos (grupos de interacción, orden por seguidores)
  // sobre las tablas que más crecen. No necesita ser realtime: destacados y
  // tendencias se sirven de la misma portada a miles de personas, y la lista de
  // personajes populares es idéntica para todos los perfiles sin señales. Se
  // comparte la carga entre llamadas simultáneas (`inFlight`) y los fallos no se
  // cachean, para que la caída de la base se recupere sola en el siguiente trazo.

  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly CACHE_MAX = 400;

  private async cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    this.pruneCache();

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    const now = Date.now();

    if (entry && entry.expiresAt > now) {
      return entry.value;
    }
    if (entry?.inFlight) {
      return entry.inFlight;
    }

    const promise = loader();
    this.cache.set(key, { value: undefined as unknown as T, expiresAt: 0, inFlight: promise });

    promise.then(
      (value) => {
        this.cache.set(key, { value, expiresAt: Date.now() + ttlMs, inFlight: null });
      },
      () => {
        if (this.cache.get(key)?.inFlight === promise) {
          this.cache.delete(key);
        }
      },
    );

    return promise;
  }

  /** Borra lo expirado y, si sigue por encima del tope, lo más antiguo. */
  private pruneCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt !== 0 && entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
    while (this.cache.size > this.CACHE_MAX) {
      const first = this.cache.keys().next().value;
      if (first === undefined) break;
      this.cache.delete(first);
    }
  }

  /** Invalida la portada cuando admin toca la curación. */
  private invalidateFeatured(): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith('featured:')) {
        this.cache.delete(key);
      }
    }
  }

  // --- Contenido destacado --------------------------------------------------

  /**
   * Lista curada por administración. Si no hay nada vigente, cae a los relatos
   * que sus propios autores destacaron en su perfil, para que la portada no
   * quede vacía. `curated` indica de dónde salió la lista.
   */
  async listFeatured(limit?: number) {
    const take = this.clamp(limit);
    return this.cached(`featured:${take}`, env.discovery.featuredCacheMs, () =>
      this.computeFeatured(take),
    );
  }

  private async computeFeatured(take: number) {
    const now = new Date();

    const curated = await this.prisma.featuredStory.findMany({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      take,
      select: { storyId: true, note: true },
    });

    const curatedItems = await this.storiesService.listPublicByIds(
      curated.map((row) => row.storyId),
    );

    if (curatedItems.length > 0) {
      const noteById = new Map(curated.map((row) => [row.storyId, row.note]));
      return {
        curated: true,
        items: curatedItems.map((item) => ({ ...item, note: noteById.get(item.id) ?? null })),
      };
    }

    const featuredByAuthors = await this.prisma.story.findMany({
      where: { status: 'PUBLISHED', visibility: 'PUBLIC', featuredAt: { not: null } },
      orderBy: [{ featuredAt: 'desc' }, { id: 'desc' }],
      take,
      select: { id: true },
    });

    const fallbackItems = await this.storiesService.listPublicByIds(
      featuredByAuthors.map((row) => row.id),
    );

    return {
      curated: false,
      items: fallbackItems.map((item) => ({ ...item, note: null as string | null })),
    };
  }

  // --- Tendencias -----------------------------------------------------------

  /**
   * Relatos con más interacción reciente (acompañamientos y comentarios dentro
   * de la ventana configurada). Cada acompañamiento pesa el doble que un
   * comentario: es la señal fuerte de esta plataforma.
   */
  async listTrending(limit?: number) {
    const take = this.clamp(limit);
    return this.cached(`trending:${take}`, env.discovery.trendingCacheMs, () =>
      this.computeTrending(take),
    );
  }

  private async computeTrending(take: number) {
    const since = new Date(Date.now() - env.discovery.trendingWindowDays * 86_400_000);

    const [supportRows, commentRows] = (await Promise.all([
      this.prisma.companionship.groupBy({
        by: ['targetStoryId'],
        where: { targetStoryId: { not: null }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.comment.groupBy({
        by: ['storyId'],
        where: { createdAt: { gte: since }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ])) as [SupportRow[], CommentRow[]];

    const scores = new Map<string, number>();
    for (const row of supportRows) {
      if (row.targetStoryId) {
        scores.set(row.targetStoryId, (scores.get(row.targetStoryId) ?? 0) + row._count._all * 2);
      }
    }
    for (const row of commentRows) {
      scores.set(row.storyId, (scores.get(row.storyId) ?? 0) + row._count._all);
    }

    if (scores.size === 0) {
      return { items: [] };
    }

    const orderedIds = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      // Se pide un margen porque `listPublicByIds` descarta lo que ya no está
      // publicado o dejó de ser público.
      .slice(0, take * 2);

    const items = await this.storiesService.listPublicByIds(orderedIds);

    return {
      items: items
        .slice(0, take)
        .map((item) => ({ ...item, trendScore: scores.get(item.id) ?? 0 })),
    };
  }

  // --- Personajes recomendados ----------------------------------------------

  async listRecommendedCharacters(
    userId: string,
    limit?: number,
  ): Promise<{ items: RecommendedCharacter[] }> {
    const take = this.clamp(limit);

    const own = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true, interests: { select: { interestId: true } } },
    });

    // Sin personaje propio no hay señales de afinidad; se recomienda igualmente
    // por popularidad, así que solo se excluye "nada".
    const ownId = own?.id ?? '';
    const ownInterestIds = new Set((own?.interests ?? []).map((row) => row.interestId));

    const followedIds = own ? await this.followedCharacterIds(own.id) : new Set<string>();

    // Piscina de candidatos. Si el perfil declara intereses, se elige con el
    // índice de `character_interests` (afinidad primero), sin tener que ordenar
    // la tabla de personajes entera. Si no tiene señales, se sirve la lista
    // global de personajes populares, que es idéntica para todos los perfiles
    // sin señales y se cachea: mil usuarios nuevos comparten una sola consulta.
    const candidateIds =
      ownInterestIds.size > 0
        ? await this.candidatesByInterest(ownId, [...ownInterestIds], followedIds)
        : await this.cached('recommended:popular', env.discovery.popularCharactersCacheMs, () =>
            this.popularCharacterIds(),
          );

    // Los detalles se descargan de la piscina elegida y se vuelve a excluir el
    // propio personaje y a los seguidos (defensa en profundidad: el estado pudo
    // cambiar entre la lectura y el cálculo).
    const candidates =
      candidateIds.length > 0
        ? (
            await this.prisma.character.findMany({
              where: { id: { in: candidateIds } },
              select: {
                id: true,
                name: true,
                tagline: true,
                avatarUrl: true,
                createdAt: true,
                privacySettings: true,
                interests: { select: { interestId: true, interest: { select: { name: true } } } },
                _count: { select: { followers: true } },
              },
            })
          ).filter((candidate) => candidate.id !== ownId && !followedIds.has(candidate.id))
        : [];

    if (candidates.length === 0) {
      return { items: [] };
    }

    const storyCounts = await this.prisma.$queryRaw<Array<{ characterId: string; count: number }>>(
      Prisma.sql`
        SELECT "characterId", COUNT(*)::int AS "count" FROM "stories"
        WHERE "characterId" IN (${Prisma.join(candidates.map((row) => row.id))})
          AND "status" = 'PUBLISHED'
        GROUP BY "characterId"
      `,
    );
    const storyCountById = new Map(storyCounts.map((row) => [row.characterId, row.count]));

    const scored = candidates.map((candidate) => {
      const shared = candidate.interests.filter((row) =>
        ownInterestIds.has(row.interestId),
      ).length;
      const stories = storyCountById.get(candidate.id) ?? 0;
      const followers = candidate._count.followers;

      const score =
        shared * 12 +
        Math.log1p(followers) * 10 +
        Math.log1p(stories) * 4 +
        this.recencyBonus(candidate.createdAt);

      return { candidate, shared, stories, followers, score };
    });

    scored.sort((a, b) => b.score - a.score || b.followers - a.followers);

    const items = scored.slice(0, take).map(({ candidate, shared, stories, followers }) => {
      const privacy = this.resolvePrivacy(candidate.privacySettings);
      return {
        name: candidate.name,
        tagline: privacy.showBio ? candidate.tagline : null,
        avatarUrl: privacy.showAvatar ? candidate.avatarUrl : null,
        interests: candidate.interests.map((row) => row.interest.name),
        stories,
        followers,
        sharedInterests: shared,
      };
    });

    return { items };
  }

  // --- Curación (administración) --------------------------------------------

  async listCurated(): Promise<{ items: CuratedFeaturedEntry[] }> {
    const rows = await this.prisma.featuredStory.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      select: {
        storyId: true,
        position: true,
        note: true,
        expiresAt: true,
        createdAt: true,
        story: {
          select: {
            title: true,
            status: true,
            visibility: true,
            character: { select: { name: true } },
          },
        },
      },
    });

    return {
      items: rows.map((row) => ({
        storyId: row.storyId,
        title: row.story.title,
        status: row.story.status,
        visibility: row.story.visibility,
        author: row.story.character.name,
        position: row.position,
        note: row.note,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      })),
    };
  }

  /**
   * Crea o actualiza el destacado de un relato. Solo relatos publicados: no
   * tiene sentido curar algo que la audiencia todavía no puede leer. `note: ''`
   * vacía la nota; omitir un campo conserva el valor anterior.
   */
  async feature(storyId: string, dto: UpsertFeaturedDto) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, status: true },
    });

    if (!story) {
      throw new NotFoundException('Ese relato no existe.');
    }
    if (story.status !== 'PUBLISHED') {
      throw new BadRequestException('Solo se pueden destacar relatos publicados.');
    }

    const note = dto.note === undefined ? undefined : dto.note.trim();
    const expiresAt = dto.expiresAt === undefined ? undefined : new Date(dto.expiresAt);

    const existing = await this.prisma.featuredStory.findUnique({
      where: { storyId },
      select: { id: true },
    });

    const result = existing
      ? await this.prisma.featuredStory.update({
          where: { storyId },
          data: {
            ...(dto.position !== undefined ? { position: dto.position } : {}),
            ...(note !== undefined ? { note: note === '' ? null : note } : {}),
            ...(expiresAt !== undefined ? { expiresAt } : {}),
          },
        })
      : await this.prisma.featuredStory.create({
          data: {
            storyId,
            position: dto.position ?? 0,
            note: note && note !== '' ? note : null,
            expiresAt: expiresAt ?? null,
          },
        });

    // La portada se sirve cacheadad; un cambio de curación debe verse de inmediato.
    this.invalidateFeatured();
    return result;
  }

  async unfeature(storyId: string): Promise<{ storyId: string }> {
    await this.prisma.featuredStory.deleteMany({ where: { storyId } });
    this.invalidateFeatured();
    return { storyId };
  }

  // --- Apoyo ----------------------------------------------------------------

  private clamp(limit?: number): number {
    return Math.min(Math.max(limit ?? env.discovery.sectionLimit, 1), MAX_SECTION);
  }

  /** Ids (sin repetir) de los personajes que sigue ese personaje. */
  private async followedCharacterIds(characterId: string): Promise<Set<string>> {
    const rows = await this.prisma.follower.findMany({
      where: { followerId: characterId, followingCharacterId: { not: null } },
      select: { followingCharacterId: true },
    });

    return new Set(
      rows
        .map((row) => row.followingCharacterId)
        .filter((id): id is string => typeof id === 'string'),
    );
  }

  /**
   * Piscina por afinidad: los personajes públicos que comparten al menos un
   * interés con el perfil, ordenados por número de intereses compartidos. Se
   * resuelve con el índice de `character_interests(interestId)`, de modo que el
   * trabajo crece con los candidatos que encajan y no con la tabla de
   * personajes entera. El propio personaje y los seguidos se excluyen en la
   * propia consulta.
   */
  private async candidatesByInterest(
    ownId: string,
    interestIds: string[],
    followedIds: Set<string>,
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT ci."characterId" AS "id", COUNT(*)::int AS "shared"
        FROM "character_interests" ci
        JOIN "characters" c ON c."id" = ci."characterId"
        WHERE ci."interestId" IN (${Prisma.join(interestIds)})
          AND (c."privacySettings" IS NULL OR c."privacySettings"->>'profileVisibility' = 'PUBLIC')
          ${ownId ? Prisma.sql`AND c."id" <> ${ownId}` : Prisma.empty}
          ${
            followedIds.size > 0
              ? Prisma.sql`AND c."id" NOT IN (${Prisma.join([...followedIds])})`
              : Prisma.empty
          }
        GROUP BY ci."characterId"
        ORDER BY "shared" DESC
        LIMIT ${env.discovery.recommendPool}
      `,
    );

    return rows.map((row) => row.id);
  }

  /**
   * Piscina por popularidad para perfiles sin señales. Ordena personajes
   * públicos por seguidores; al ser idéntica para todo perfil sin intereses, el
   * resultado se cachea y se comparte entre todos ellos.
   */
  private async popularCharacterIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT c."id"
        FROM "characters" c
        LEFT JOIN "followers" f ON f."followingCharacterId" = c."id"
        WHERE (c."privacySettings" IS NULL OR c."privacySettings"->>'profileVisibility' = 'PUBLIC')
        GROUP BY c."id"
        ORDER BY COUNT(f."id") DESC
        LIMIT ${env.discovery.recommendPool}
      `,
    );

    return rows.map((row) => row.id);
  }

  /** Empujón a los personajes recién llegados para que la novedad tenga hueco. */
  private recencyBonus(createdAt: Date): number {
    const days = (Date.now() - createdAt.getTime()) / 86_400_000;
    return days <= 30 ? ((30 - days) / 30) * 6 : 0;
  }

  private resolvePrivacy(settings: Prisma.JsonValue): { showAvatar: boolean; showBio: boolean } {
    const source = (settings ?? {}) as Record<string, unknown>;
    return {
      showAvatar: source.showAvatar !== false,
      showBio: source.showBio !== false,
    };
  }
}
