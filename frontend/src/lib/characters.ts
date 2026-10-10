import { API_URL } from './api';
import type { LoadResult } from './account';

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_NAME_LENGTH = 30;
const MAX_BIO_LENGTH = 500;
const MAX_TAGLINE_LENGTH = 120;
const MAX_INTERESTS = 8;
const MAX_INTEREST_LENGTH = 40;

export interface PublicProfile {
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
  bio: string | null;
  interests: string[];
  createdAt: string | null;
  stats?: {
    followers: number;
    following: number;
    companionshipsReceived: number;
    stories: number;
  };
  featuredStories?: PublicStoryPreview[];
  recentStories?: PublicStoryPreview[];
}

export interface PublicStoryPreview {
  id: string;
  title: string;
  category: string | null;
  opening: { content: string; mediaUrl: string | null; audioUrl: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterSearchItem {
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
  interests: string[];
  stories: number;
  followers: number;
}

/**
 * Se distingue entre "no hay perfil" y "no se pudo saber". Un perfil privado y
 * uno inexistente devuelven el mismo 404, así que `missing` no revela si el
 * seudónimo está registrado. Un 429 o un 500 no son un 404 y no se deben
 * disfrazar como tal.
 */
export type PublicProfileResult =
  | { status: 'found'; profile: PublicProfile }
  | { status: 'missing' }
  | { status: 'unavailable' };

export async function fetchPublicProfile(name: string): Promise<PublicProfileResult> {
  const normalized = name.normalize('NFKC').replace(/\s+/g, ' ').trim();

  if (!normalized || normalized.length > MAX_NAME_LENGTH) {
    return { status: 'missing' };
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}/characters/${encodeURIComponent(normalized)}`, {
      // Sin caché: al cambiar la privacidad o la biografía el perfil tiene que
      // desaparecer o actualizarse de inmediato, sin esperar a revalidar.
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { status: 'unavailable' };
  }

  if (response.status === 404) {
    return { status: 'missing' };
  }

  if (!response.ok) {
    return { status: 'unavailable' };
  }

  const profile = parseProfile(await response.json().catch(() => null));

  // Un cuerpo que no encaja con el contrato es un problema de la API, no la
  // prueba de que el perfil no exista.
  return profile ? { status: 'found', profile } : { status: 'unavailable' };
}

/**
 * La respuesta de la API no se toma como cierta: si un despliegue futuro
 * devolviera un cuerpo inesperado, la página no debe romperse ni renderizar
 * tipos inesperados.
 */
function parseStoryPreview(value: unknown): PublicStoryPreview | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const title = typeof record.title === 'string' ? record.title : null;
  if (!id || !title) return null;
  const openingRecord = (record.opening ?? {}) as Record<string, unknown>;
  return {
    id,
    title,
    category: typeof record.category === 'string' ? record.category : null,
    opening: openingRecord
      ? {
          content: typeof openingRecord.content === 'string' ? openingRecord.content : '',
          mediaUrl: isSafeImageUrl(openingRecord.mediaUrl),
          audioUrl: isSafeImageUrl(openingRecord.audioUrl),
        }
      : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
  };
}

function parseProfile(payload: unknown): PublicProfile | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const { name, tagline, avatarUrl, bio, interests, createdAt } = payload as Record<string, unknown>;

  if (typeof name !== 'string' || name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return null;
  }

  const statsRecord = (payload as Record<string, unknown>).stats ?? {};
  const stats = statsRecord as Record<string, unknown>;
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

  return {
    name,
    tagline: isBoundedString(tagline, MAX_TAGLINE_LENGTH),
    avatarUrl: isSafeImageUrl(avatarUrl),
    bio: isBoundedString(bio, MAX_BIO_LENGTH),
    interests: parseInterests(interests),
    createdAt: typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt)) ? createdAt : null,
    stats: {
      followers: num(stats.followers),
      following: num(stats.following),
      companionshipsReceived: num(stats.companionshipsReceived),
      stories: num(stats.stories),
    },
    featuredStories: Array.isArray((payload as Record<string, unknown>).featuredStories)
      ? ((payload as Record<string, unknown>).featuredStories as unknown[])
          .map(parseStoryPreview)
          .filter((item): item is PublicStoryPreview => item !== null)
      : [],
    recentStories: Array.isArray((payload as Record<string, unknown>).recentStories)
      ? ((payload as Record<string, unknown>).recentStories as unknown[])
          .map(parseStoryPreview)
          .filter((item): item is PublicStoryPreview => item !== null)
      : [],
  };
}

function isBoundedString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.slice(0, max) : null;
}

/**
 * Los intereses llegan del catálogo curado por el servidor, pero el perfil se
 * dibuja con lo que se reciba: se limita el número y la longitud de cada uno y
 * se descartan duplicados, igual que hace la API al guardar.
 */
function parseInterests(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.slice(0, MAX_INTEREST_LENGTH))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, MAX_INTERESTS);
}

/**
 * Solo http(s). Cualquier otro esquema (por ejemplo `javascript:` o `data:`)
 * queda descartado aunque la base llegara a contenerlo.
 */
function isSafeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') {
    return null;
  }

  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

/** Búsqueda pública de personajes por prefijo del seudónimo. */
export async function searchCharacters(
  rawQ: string,
  limit = 20,
): Promise<LoadResult<{ items: CharacterSearchItem[] }>> {
  const q = rawQ.normalize('NFKC').trim();
  if (!q) {
    return { status: 'ok', data: { items: [] } };
  }

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/characters/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { Accept: 'application/json' } },
    );
  } catch {
    return { status: 'error', message: 'No se pudo contactar con el servidor.' };
  }

  if (!response.ok) {
    return { status: 'error', message: 'No se pudo buscar personajes.' };
  }

  const body = (await response.json().catch(() => null)) as { items?: unknown[] } | null;
  const items = Array.isArray(body?.items) ? body.items : [];
  const parsed = items
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const name = typeof row.name === 'string' ? row.name : null;
      if (!name) return null;
      return {
        name,
        tagline: isBoundedString(row.tagline, MAX_TAGLINE_LENGTH),
        avatarUrl: isSafeImageUrl(row.avatarUrl),
        interests: parseInterests(row.interests),
        stories: typeof row.stories === 'number' ? row.stories : 0,
        followers: typeof row.followers === 'number' ? row.followers : 0,
      } satisfies CharacterSearchItem;
    })
    .filter((item): item is CharacterSearchItem => item !== null);

  return { status: 'ok', data: { items: parsed } };
}

export function formatJoinDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
