import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ITEMS = 100;

export interface EmotionalLogEmotion {
  id: string;
  name: string;
  colorHex: string | null;
}

export interface EmotionalLog {
  id: string;
  intensity: number;
  contextNote: string | null;
  loggedAt: string;
  createdAt: string;
  emotion: EmotionalLogEmotion;
}

export interface EmotionalDayBucket {
  date: string;
  entries: number;
  averageIntensity: number | null;
  emotion: { name: string; colorHex: string | null } | null;
}

export interface EmotionalEmotionBucket {
  name: string;
  colorHex: string | null;
  count: number;
  averageIntensity: number | null;
}

export interface EmotionalSummary {
  range: { days: number; from: string; to: string };
  totalEntries: number;
  averageIntensity: number | null;
  currentStreak: number;
  days: EmotionalDayBucket[];
  emotions: EmotionalEmotionBucket[];
}

export interface CreateEmotionalLogInput {
  emotion: string;
  intensity: number;
  loggedAt?: string;
  contextNote?: string;
}

export interface UpdateEmotionalLogInput {
  emotion?: string;
  intensity?: number;
  loggedAt?: string;
  contextNote?: string;
}

/**
 * El registro rápido usa franjas del día en vez de una hora exacta. Se traducen
 * a una hora local razonable; «Todo el día» conserva la hora actual. Si la hora
 * de la franja aún no ha llegado (p. ej. «Noche» a mediodía), se usa la hora
 * actual: el backend rechaza cualquier registro con fecha futura.
 */
export function daypartToLoggedAt(daypart: string, now: Date = new Date()): string {
  const date = new Date(now);
  const hour = daypart === 'Mañana' ? 9 : daypart === 'Tarde' ? 15 : daypart === 'Noche' ? 21 : date.getHours();
  date.setHours(hour, 0, 0, 0);
  return (date.getTime() > now.getTime() ? now : date).toISOString();
}

/**
 * Desfase del huso horario en minutos, en la convención que espera el backend
 * (la misma que `Date.getTimezoneOffset()`): minutos de UTC menos la hora local.
 * Agrupa el mapa por día local.
 */
export function timezoneOffsetMinutes(date: Date = new Date()): number {
  return date.getTimezoneOffset();
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
    const record = (body ?? {}) as Record<string, unknown>;
    const message = record.message;
    return {
      status: 'error',
      message: Array.isArray(message)
        ? message.join(' ')
        : typeof message === 'string' && message.trim()
          ? message
          : fallback,
    };
  }

  try {
    const parsed = parse(await response.json());
    return parsed === null ? { status: 'error', message: fallback } : { status: 'ok', data: parsed };
  } catch {
    return { status: 'error', message: fallback };
  }
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function parseEmotion(value: unknown): EmotionalLogEmotion | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = asString(record.id);
  const name = asString(record.name);
  if (!id || !name) return null;
  return { id, name, colorHex: asString(record.colorHex) };
}

function parseLog(value: unknown): EmotionalLog | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = asString(record.id);
  const intensity = asNumber(record.intensity);
  const emotion = parseEmotion(record.emotion);
  if (!id || intensity === null || !emotion) return null;

  return {
    id,
    intensity,
    contextNote: asString(record.contextNote),
    loggedAt: asString(record.loggedAt) ?? '',
    createdAt: asString(record.createdAt) ?? '',
    emotion,
  };
}

function parseDashboard(body: unknown): { items: EmotionalLog[]; nextCursor: string | null } | null {
  const record = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(record.items)) return null;

  return {
    items: record.items
      .map(parseLog)
      .filter((item): item is EmotionalLog => item !== null)
      .slice(0, MAX_ITEMS),
    nextCursor: asString(record.nextCursor),
  };
}

function parseSummary(body: unknown): EmotionalSummary | null {
  const record = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(record.days) || !Array.isArray(record.emotions)) return null;

  const range = (record.range ?? {}) as Record<string, unknown>;

  return {
    range: {
      days: asNumber(range.days) ?? 0,
      from: asString(range.from) ?? '',
      to: asString(range.to) ?? '',
    },
    totalEntries: asNumber(record.totalEntries) ?? 0,
    averageIntensity: asNumber(record.averageIntensity),
    currentStreak: asNumber(record.currentStreak) ?? 0,
    days: record.days
      .map((item): EmotionalDayBucket | null => {
        const bucket = (item ?? {}) as Record<string, unknown>;
        const date = asString(bucket.date);
        if (!date) return null;
        const emotion = (bucket.emotion ?? null) as Record<string, unknown> | null;
        const name = emotion ? asString(emotion.name) : null;
        return {
          date,
          entries: asNumber(bucket.entries) ?? 0,
          averageIntensity: asNumber(bucket.averageIntensity),
          emotion: name ? { name, colorHex: emotion ? asString(emotion.colorHex) : null } : null,
        };
      })
      .filter((item): item is EmotionalDayBucket => item !== null),
    emotions: record.emotions
      .map((item): EmotionalEmotionBucket | null => {
        const bucket = (item ?? {}) as Record<string, unknown>;
        const name = asString(bucket.name);
        if (!name) return null;
        return {
          name,
          colorHex: asString(bucket.colorHex),
          count: asNumber(bucket.count) ?? 0,
          averageIntensity: asNumber(bucket.averageIntensity),
        };
      })
      .filter((item): item is EmotionalEmotionBucket => item !== null),
  };
}

export function createEmotionalLog(
  input: CreateEmotionalLogInput,
): Promise<LoadResult<EmotionalLog>> {
  return request('/emotional-logs', json('POST', input), 'No se pudo guardar tu registro.', parseLog);
}

export function listEmotionalLogs(params: {
  cursor?: string;
  limit?: number;
  from?: string;
  to?: string;
}): Promise<LoadResult<{ items: EmotionalLog[]; nextCursor: string | null }>> {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  const query = search.toString();

  return request(
    `/emotional-logs${query ? `?${query}` : ''}`,
    { method: 'GET' },
    'No se pudieron cargar tus registros.',
    parseDashboard,
  );
}

export function getEmotionalSummary(params: {
  days?: number;
  tzOffsetMinutes?: number;
}): Promise<LoadResult<EmotionalSummary>> {
  const search = new URLSearchParams();
  if (params.days) search.set('days', String(params.days));
  if (params.tzOffsetMinutes !== undefined) {
    search.set('tzOffsetMinutes', String(params.tzOffsetMinutes));
  }
  const query = search.toString();

  return request(
    `/emotional-logs/summary${query ? `?${query}` : ''}`,
    { method: 'GET' },
    'No se pudo cargar el mapa emocional.',
    parseSummary,
  );
}

export function updateEmotionalLog(
  id: string,
  input: UpdateEmotionalLogInput,
): Promise<LoadResult<EmotionalLog>> {
  return request(
    `/emotional-logs/${encodeURIComponent(id)}`,
    json('PATCH', input),
    'No se pudo actualizar el registro.',
    parseLog,
  );
}

export function deleteEmotionalLog(id: string): Promise<LoadResult<{ id: string }>> {
  return request(
    `/emotional-logs/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'No se pudo eliminar el registro.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const resultId = asString(record.id);
      return resultId ? { id: resultId } : null;
    },
  );
}
