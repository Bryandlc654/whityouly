import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';
import type { FollowingStory, StoryEmotion, StoryStage } from './stories';

export interface FeaturedStory extends FollowingStory {
  note: string | null;
}

export interface TrendStory extends FollowingStory {
  trendScore: number;
}

export interface RecommendedCharacter {
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
  interests: string[];
  stories: number;
  followers: number;
  sharedInterests: number;
}

export interface DiscoveryFeatured {
  curated: boolean;
  items: FeaturedStory[];
}

const REQUEST_TIMEOUT_MS = 10_000;

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

function parseNames(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseEmotions(value: unknown): StoryEmotion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : null;
      if (!name) return null;
      return { name, colorHex: typeof record.colorHex === 'string' ? record.colorHex : null };
    })
    .filter((item): item is StoryEmotion => item !== null);
}

function parseStage(value: unknown): StoryStage | null {
  const record = (value ?? {}) as Record<string, unknown>;
  if (typeof record.id !== 'string') return null;
  return {
    id: record.id,
    content: typeof record.content === 'string' ? record.content : '',
    mediaUrl: safeUrl(record.mediaUrl),
    audioUrl: safeUrl(record.audioUrl),
    stageOrder: typeof record.stageOrder === 'number' ? record.stageOrder : 0,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
  };
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Misma forma que `FollowingStory` del feed, para poder reutilizar su tarjeta. */
function parseStoryItem(value: unknown, extra: Partial<FollowingStory> = {}): FollowingStory | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const title = typeof record.title === 'string' ? record.title : null;
  const authorRecord = (record.author ?? {}) as Record<string, unknown>;
  const authorName = typeof authorRecord.name === 'string' ? authorRecord.name : null;
  if (!id || !title || !authorName) return null;

  return {
    id,
    title,
    author: { name: authorName, avatarUrl: safeUrl(authorRecord.avatarUrl) },
    categories: parseNames(record.categories),
    emotions: parseEmotions(record.emotions),
    tags: parseNames(record.tags),
    opening: parseStage(record.opening),
    stageCount: numberOr(record.stageCount),
    supportCount: numberOr(record.supportCount),
    commentCount: numberOr(record.commentCount),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
    ...extra,
  };
}

function messageFrom(body: unknown, fallback: string): string {
  const record = (body ?? {}) as Record<string, unknown>;
  const message = record.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

async function request<T>(
  path: string,
  init: RequestInit,
  fallback: string,
  parse: (body: unknown) => T | null,
): Promise<LoadResult<T>> {
  let response: Response;
  try {
    response = await authFetch(`${API_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { status: 'error', message: 'No se pudo contactar con el servidor.' };
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      /* sin cuerpo */
    }
    return { status: 'error', message: messageFrom(body, fallback) };
  }

  try {
    const parsed = parse(await response.json());
    return parsed === null ? { status: 'error', message: fallback } : { status: 'ok', data: parsed };
  } catch {
    return { status: 'error', message: fallback };
  }
}

/** Contenido destacado (curado por administración). No requiere sesión. */
export function getFeaturedStories(limit = 12): Promise<LoadResult<DiscoveryFeatured>> {
  return request(
    `/discover/featured?limit=${limit}`,
    { method: 'GET' },
    'No se pudo cargar el contenido destacado.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items
            .map((item) => {
              const base = parseStoryItem(item);
              if (!base) return null;
              const note =
                typeof (item as Record<string, unknown>).note === 'string'
                  ? ((item as Record<string, unknown>).note as string)
                  : null;
              return { ...base, note } satisfies FeaturedStory;
            })
            .filter((item): item is FeaturedStory => item !== null)
        : [];
      return { curated: record.curated === true, items };
    },
  );
}

/** Relatos en tendencia por interacción reciente. */
export function getTrendingStories(limit = 12): Promise<LoadResult<{ items: TrendStory[] }>> {
  return request(
    `/discover/trends?limit=${limit}`,
    { method: 'GET' },
    'No se pudieron cargar las tendencias.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items
            .map((item) => {
              const base = parseStoryItem(item);
              if (!base) return null;
              const trendScore = numberOr((item as Record<string, unknown>).trendScore);
              return { ...base, trendScore } satisfies TrendStory;
            })
            .filter((item): item is TrendStory => item !== null)
        : [];
      return { items };
    },
  );
}

/** Personajes recomendados según los intereses y seguidos del usuario. */
export function getRecommendedCharacters(
  limit = 12,
): Promise<LoadResult<{ items: RecommendedCharacter[] }>> {
  return request(
    `/discover/characters?limit=${limit}`,
    { method: 'GET' },
    'No se pudieron cargar los personajes recomendados.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items
            .map((item) => {
              const row = (item ?? {}) as Record<string, unknown>;
              const name = typeof row.name === 'string' ? row.name : null;
              if (!name) return null;
              return {
                name,
                tagline: typeof row.tagline === 'string' ? row.tagline : null,
                avatarUrl: safeUrl(row.avatarUrl),
                interests: parseNames(row.interests),
                stories: numberOr(row.stories),
                followers: numberOr(row.followers),
                sharedInterests: numberOr(row.sharedInterests),
              } satisfies RecommendedCharacter;
            })
            .filter((item): item is RecommendedCharacter => item !== null)
        : [];
      return { items };
    },
  );
}