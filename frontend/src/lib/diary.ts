import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

export type DiaryEntryKind = 'NOTE' | 'EMOTIONAL';
export type DiaryEntryType = 'ALL' | 'NOTE' | 'EMOTIONAL';

export interface DiaryEntry {
  kind: DiaryEntryKind;
  id: string;
  title: string | null;
  content: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  emotion: { name: string; colorHex: string | null } | null;
  intensity: number | null;
}

export interface DiaryList {
  items: DiaryEntry[];
  trashCount: number;
  nextCursor: { at: string; id: string } | null;
}

export interface DiaryQuery {
  q?: string;
  from?: string;
  to?: string;
  type?: DiaryEntryType;
  trash?: boolean;
  limit?: number;
  before?: string;
  beforeId?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

function messageFrom(body: unknown, fallback: string): string {
  const record = (body ?? {}) as Record<string, unknown>;
  const message = record.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseEntry(value: unknown): DiaryEntry | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const kind = asString(record.kind);
  const id = asString(record.id);
  const occurredAt = asString(record.occurredAt);
  if ((kind !== 'NOTE' && kind !== 'EMOTIONAL') || !id || !occurredAt) return null;

  const emotion = (record.emotion ?? null) as Record<string, unknown> | null;
  const emotionName = emotion ? asString(emotion.name) : null;

  return {
    kind,
    id,
    title: asString(record.title),
    content: asString(record.content),
    occurredAt,
    createdAt: asString(record.createdAt) ?? occurredAt,
    updatedAt: asString(record.updatedAt) ?? occurredAt,
    deletedAt: asString(record.deletedAt),
    emotion: emotionName
      ? { name: emotionName, colorHex: emotion ? asString(emotion.colorHex) : null }
      : null,
    intensity: asNumber(record.intensity),
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

export function listDiary(query: DiaryQuery): Promise<LoadResult<DiaryList>> {
  const search = new URLSearchParams();
  if (query.q?.trim()) search.set('q', query.q.trim());
  if (query.from) search.set('from', query.from);
  if (query.to) search.set('to', query.to);
  if (query.type && query.type !== 'ALL') search.set('type', query.type);
  if (query.trash) search.set('trash', 'true');
  if (query.limit) search.set('limit', String(query.limit));
  if (query.before) search.set('before', query.before);
  if (query.beforeId) search.set('beforeId', query.beforeId);

  const suffix = search.toString();
  return request(
    `/diary${suffix ? `?${suffix}` : ''}`,
    { method: 'GET' },
    'No se pudo cargar tu diario.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      if (!Array.isArray(record.items)) return null;
      return {
        items: record.items.map(parseEntry).filter((item): item is DiaryEntry => item !== null),
        trashCount: asNumber(record.trashCount) ?? 0,
        nextCursor:
          record.nextCursor && typeof record.nextCursor === 'object'
            ? (() => {
                const cursor = record.nextCursor as Record<string, unknown>;
                const at = asString(cursor.at);
                const id = asString(cursor.id);
                return at && id ? { at, id } : null;
              })()
            : null,
      };
    },
  );
}

export function createDiaryNote(input: {
  title?: string;
  content: string;
}): Promise<LoadResult<DiaryEntry>> {
  return request(
    '/diary/notes',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'No se pudo guardar la nota.',
    parseEntry,
  );
}

export function updateDiaryNote(
  id: string,
  input: { title?: string; content?: string },
): Promise<LoadResult<DiaryEntry>> {
  return request(
    `/diary/notes/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'No se pudo actualizar la nota.',
    parseEntry,
  );
}

export function deleteDiaryNote(id: string): Promise<LoadResult<{ id: string }>> {
  return request(
    `/diary/notes/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'No se pudo mover la nota a la papelera.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return typeof record.id === 'string' ? { id: record.id } : null;
    },
  );
}

export function restoreDiaryNote(id: string): Promise<LoadResult<DiaryEntry>> {
  return request(
    `/diary/notes/${encodeURIComponent(id)}/restore`,
    { method: 'PATCH' },
    'No se pudo restaurar la nota.',
    parseEntry,
  );
}
