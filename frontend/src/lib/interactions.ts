import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

const REQUEST_TIMEOUT_MS = 15_000;

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
    const record = (body ?? {}) as Record<string, unknown>;
    const message = record.message;
    return {
      status: 'error',
      message:
        Array.isArray(message) ? message.join(' ') : typeof message === 'string' && message.trim() ? message : fallback,
    };
  }

  try {
    const parsed = parse(await response.json());
    return parsed === null ? { status: 'error', message: fallback } : { status: 'ok', data: parsed };
  } catch {
    return { status: 'error', message: fallback };
  }
}

interface ToggleResult {
  supporting?: boolean;
  following?: boolean;
  count?: number;
}

const parseToggle = (body: unknown): ToggleResult => {
  const record = (body ?? {}) as Record<string, unknown>;
  const result: ToggleResult = {};
  if (typeof record.supporting === 'boolean') result.supporting = record.supporting;
  if (typeof record.following === 'boolean') result.following = record.following;
  if (typeof record.count === 'number') result.count = record.count;
  return result;
};

/** Acompañar ("Estoy contigo") un relato. Devuelve el nuevo total. */
export function supportStory(id: string): Promise<LoadResult<{ supporting: boolean; count: number }>> {
  return request(
    `/stories/${encodeURIComponent(id)}/support`,
    { method: 'POST' },
    'No se pudo enviar tu apoyo.',
    (body) => {
      const parsed = parseToggle(body);
      return parsed.supporting === true && typeof parsed.count === 'number'
        ? { supporting: true, count: parsed.count }
        : null;
    },
  );
}

export function unsupportStory(id: string): Promise<LoadResult<{ supporting: false; count: number }>> {
  return request(
    `/stories/${encodeURIComponent(id)}/support`,
    { method: 'DELETE' },
    'No se pudo retirar tu apoyo.',
    (body) => {
      const parsed = parseToggle(body);
      return parsed.supporting === false && typeof parsed.count === 'number'
        ? { supporting: false, count: parsed.count }
        : null;
    },
  );
}

/** Seguir un relato (recibir sus actualizaciones). */
export function followStory(id: string): Promise<LoadResult<{ following: true }>> {
  return request(
    `/stories/${encodeURIComponent(id)}/follow`,
    { method: 'POST' },
    'No se pudo seguir el relato.',
    (body) => {
      const parsed = parseToggle(body);
      return parsed.following === true ? { following: true } : null;
    },
  );
}

export function unfollowStory(id: string): Promise<LoadResult<{ following: false }>> {
  return request(
    `/stories/${encodeURIComponent(id)}/follow`,
    { method: 'DELETE' },
    'No se pudo dejar de seguir el relato.',
    (body) => {
      const parsed = parseToggle(body);
      return parsed.following === false ? { following: false } : null;
    },
  );
}