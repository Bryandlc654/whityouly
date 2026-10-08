import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

export interface FollowedCharacter {
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
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

export function followCharacter(name: string): Promise<LoadResult<{ following: boolean }>> {
  return request(
    `/characters/${encodeURIComponent(name)}/follow`,
    { method: 'POST' },
    'No se pudo seguir a este personaje.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return { following: record.following === true };
    },
  );
}

export function unfollowCharacter(name: string): Promise<LoadResult<{ following: boolean }>> {
  return request(
    `/characters/${encodeURIComponent(name)}/follow`,
    { method: 'DELETE' },
    'No se pudo dejar de seguir a este personaje.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return { following: record.following === true };
    },
  );
}

export function listFollowing(): Promise<LoadResult<{ items: FollowedCharacter[] }>> {
  return request(
    '/characters/me/following',
    { method: 'GET' },
    'No se pudieron cargar tus seguidos.',
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
              } satisfies FollowedCharacter;
            })
            .filter((item): item is FollowedCharacter => item !== null)
        : [];
      return { items };
    },
  );
}
