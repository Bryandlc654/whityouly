import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

export interface Capsule {
  id: string;
  title: string;
  content: string;
  mood: string | null;
  openAt: string;
  createdAt: string;
  updatedAt: string;
  isOpen: boolean;
}

const REQUEST_TIMEOUT_MS = 15_000;

function messageFrom(body: unknown, fallback: string): string {
  const record = (body ?? {}) as Record<string, unknown>;
  const message = record.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

function parseCapsule(value: unknown): Capsule | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const content = typeof record.content === 'string' ? record.content : null;
  const openAt = typeof record.openAt === 'string' ? record.openAt : null;
  if (!id || !content || !openAt) return null;

  return {
    id,
    title: typeof record.title === 'string' ? record.title : content.slice(0, 60),
    content,
    mood: typeof record.mood === 'string' ? record.mood : null,
    openAt,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
    isOpen: record.isOpen === true || new Date(openAt).getTime() <= Date.now(),
  };
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

export function listCapsules(): Promise<LoadResult<{ items: Capsule[] }>> {
  return request('/capsules', { method: 'GET' }, 'No se pudieron cargar tus cápsulas.', (body) => {
    const record = (body ?? {}) as Record<string, unknown>;
    if (!Array.isArray(record.items)) return null;
    return {
      items: record.items
        .map(parseCapsule)
        .filter((item): item is Capsule => item !== null),
    };
  });
}

export function createCapsule(input: {
  content: string;
  mood?: string;
  openAt: string;
}): Promise<LoadResult<Capsule>> {
  return request(
    '/capsules',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'No se pudo guardar la cápsula.',
    parseCapsule,
  );
}

export function updateCapsule(
  id: string,
  input: { content?: string; mood?: string; openAt?: string },
): Promise<LoadResult<Capsule>> {
  return request(
    `/capsules/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'No se pudo actualizar la cápsula.',
    parseCapsule,
  );
}

export function deleteCapsule(id: string): Promise<LoadResult<{ id: string }>> {
  return request(
    `/capsules/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'No se pudo eliminar la cápsula.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return typeof record.id === 'string' ? { id: record.id } : null;
    },
  );
}
