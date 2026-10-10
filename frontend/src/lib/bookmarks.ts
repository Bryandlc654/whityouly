import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

export interface SavedStory {
  id: string;
  title: string;
  visibility: string;
  author: { name: string; avatarUrl: string | null } | null;
  opening: { content: string; mediaUrl: string | null; audioUrl: string | null } | null;
  savedAt: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
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

function parseSaved(value: unknown): SavedStory | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const title = typeof record.title === 'string' ? record.title : null;
  if (!id || !title) return null;
  const authorRecord = (record.author ?? {}) as Record<string, unknown>;
  const openingRecord = (record.opening ?? {}) as Record<string, unknown>;
  return {
    id,
    title,
    visibility: typeof record.visibility === 'string' ? record.visibility : 'PUBLIC',
    author:
      typeof authorRecord.name === 'string'
        ? { name: authorRecord.name, avatarUrl: safeUrl(authorRecord.avatarUrl) }
        : null,
    opening: openingRecord
      ? {
          content: typeof openingRecord.content === 'string' ? openingRecord.content : '',
          mediaUrl: safeUrl(openingRecord.mediaUrl),
          audioUrl: safeUrl(openingRecord.audioUrl),
        }
      : null,
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : new Date(0).toISOString(),
  };
}

/** Guardar un relato en privado (idempotente). */
export function saveStory(id: string): Promise<LoadResult<{ saved: boolean }>> {
  return request(
    `/bookmarks/story/${encodeURIComponent(id)}`,
    { method: 'POST' },
    'No se pudo guardar el relato.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return record.saved === true ? { saved: true } : null;
    },
  );
}

export function unsaveStory(id: string): Promise<LoadResult<{ saved: boolean }>> {
  return request(
    `/bookmarks/story/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'No se pudo quitar el relato de guardados.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return record.saved === false ? { saved: false } : null;
    },
  );
}

/** Mis guardados (privados). */
export function listSavedStories(): Promise<LoadResult<{ items: SavedStory[] }>> {
  return request(
    '/bookmarks',
    { method: 'GET' },
    'No se pudieron cargar tus guardados.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items
            .map(parseSaved)
            .filter((item: SavedStory | null): item is SavedStory => item !== null)
        : [];
      return { items };
    },
  );
}