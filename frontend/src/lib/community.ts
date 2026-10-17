import { API_URL } from './api';
import { authFetch } from './auth';

export interface PulseEmotion {
  name: string;
  colorHex: string | null;
}

export interface CommunityEmotionBucket extends PulseEmotion {
  count: number;
  /** Proporción sobre el total de registros publicados (0 a 1). */
  share: number;
  participants: number;
}

export interface CommunityDayBucket {
  date: string;
  entries: number;
  averageIntensity: number | null;
  emotion: PulseEmotion | null;
  suppressed: boolean;
}

export interface CommunityMomentBucket {
  key: string;
  entries: number;
  averageIntensity: number | null;
  topEmotion: PulseEmotion | null;
  suppressed: boolean;
}

export interface CommunityPulse {
  range: { days: number; from: string; to: string };
  privacy: { minUsers: number; participants: number; suppressed: boolean; note: string };
  totalEntries: number;
  averageIntensity: number | null;
  dominantEmotion: PulseEmotion | null;
  emotions: CommunityEmotionBucket[];
  days: CommunityDayBucket[];
  weekdays: CommunityMomentBucket[];
  dayparts: CommunityMomentBucket[];
}

export interface CommunityPulseParams {
  days?: number;
  tzOffsetMinutes?: number;
}

const REQUEST_TIMEOUT_MS = 15_000;

function safeHex(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : null;
}

function parseEmotion(value: unknown): PulseEmotion | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const name = typeof record.name === 'string' && record.name.trim() ? record.name : null;
  return name ? { name, colorHex: safeHex(record.colorHex) } : null;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parsePulse(payload: unknown): CommunityPulse | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;

  const privacyRecord = (record.privacy ?? {}) as Record<string, unknown>;
  const rangeRecord = (record.range ?? {}) as Record<string, unknown>;

  return {
    range: {
      days: num(rangeRecord.days),
      from: typeof rangeRecord.from === 'string' ? rangeRecord.from : new Date(0).toISOString(),
      to: typeof rangeRecord.to === 'string' ? rangeRecord.to : new Date().toISOString(),
    },
    privacy: {
      minUsers: num(privacyRecord.minUsers, 5),
      participants: num(privacyRecord.participants),
      suppressed: privacyRecord.suppressed === true,
      note: typeof privacyRecord.note === 'string' ? privacyRecord.note : '',
    },
    totalEntries: num(record.totalEntries),
    averageIntensity:
      typeof record.averageIntensity === 'number' ? record.averageIntensity : null,
    dominantEmotion: parseEmotion(record.dominantEmotion),
    emotions: Array.isArray(record.emotions)
      ? record.emotions.flatMap((item) => {
          const emotion = parseEmotion(item);
          if (!emotion) return [];
          const bucket = item as Record<string, unknown>;
          return [
            {
              ...emotion,
              count: num(bucket.count),
              share: num(bucket.share),
              participants: num(bucket.participants),
            },
          ];
        })
      : [],
    days: Array.isArray(record.days)
      ? record.days.flatMap((item) => {
          const bucket = (item ?? {}) as Record<string, unknown>;
          const date = typeof bucket.date === 'string' ? bucket.date : null;
          if (!date) return [];
          return [
            {
              date,
              entries: num(bucket.entries),
              averageIntensity:
                typeof bucket.averageIntensity === 'number' ? bucket.averageIntensity : null,
              emotion: parseEmotion(bucket.emotion),
              suppressed: bucket.suppressed === true,
            },
          ];
        })
      : [],
    weekdays: parseMoments(record.weekdays),
    dayparts: parseMoments(record.dayparts),
  };
}

function parseMoments(value: unknown): CommunityMomentBucket[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const bucket = (item ?? {}) as Record<string, unknown>;
    const key = typeof bucket.key === 'string' ? bucket.key : null;
    if (!key) return [];
    return [
      {
        key,
        entries: num(bucket.entries),
        averageIntensity:
          typeof bucket.averageIntensity === 'number' ? bucket.averageIntensity : null,
        topEmotion: parseEmotion(bucket.topEmotion),
        suppressed: bucket.suppressed === true,
      },
    ];
  });
}

export async function getCommunityPulse(
  params: CommunityPulseParams = {},
): Promise<CommunityPulse> {
  const search = new URLSearchParams();
  if (params.days) search.set('days', String(params.days));
  if (params.tzOffsetMinutes !== undefined) {
    search.set('tzOffsetMinutes', String(params.tzOffsetMinutes));
  }

  const query = search.toString();
  let response: Response;
  try {
    response = await authFetch(`${API_URL}/community/pulse${query ? `?${query}` : ''}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error('No se pudo contactar con el servidor.');
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      /* sin cuerpo */
    }
    const message = (body as { message?: unknown } | null)?.message;
    throw new Error(
      Array.isArray(message)
        ? message.join(' ')
        : typeof message === 'string' && message.trim()
          ? message
          : 'No se pudo cargar el pulso comunitario.',
    );
  }

  const parsed = parsePulse(await response.json().catch(() => null));
  if (!parsed) {
    throw new Error('La respuesta del pulso comunitario no es válida.');
  }
  return parsed;
}
