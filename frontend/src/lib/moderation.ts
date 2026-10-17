import { API_URL } from './api';
import { authFetch } from './auth';
import { REPORT_REASONS, type ReportReason } from './comments';
import type { LoadResult } from './account';

export { REPORT_REASONS };
export type { ReportReason };

/** Etiquetas legibles para elegir el motivo del reporte. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: 'Spam o publicidad',
  HARASSMENT: 'Acoso',
  OFFENSIVE: 'Contenido ofensivo',
  SEXUAL: 'Contenido sexual',
  THREATS: 'Amenazas',
  IMPERSONATION: 'Suplantación de identidad',
  ILLEGAL: 'Actividad ilegal',
  OTHER: 'Otro motivo',
};

export const APPEAL_MESSAGE_MIN_LENGTH = 10;
export const APPEAL_MESSAGE_MAX_LENGTH = 1000;

/** Tipos de contenido que se pueden apelar (solo contenido propio oculto). */
export const APPEAL_TARGETS = ['STORY', 'COMMENT'] as const;
export type AppealTarget = (typeof APPEAL_TARGETS)[number];

export type AppealStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface AppealTargetSummary {
  id: string;
  type: string;
  title: string | null;
  authorName: string | null;
  status: string | null;
  storyId: string | null;
}

export interface Appeal {
  id: string;
  targetType: AppealTarget;
  targetId: string;
  reportId: string | null;
  message: string;
  status: AppealStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  target: AppealTargetSummary | null;
}

export interface AppealPage {
  items: Appeal[];
  nextCursor: string | null;
}

const REQUEST_TIMEOUT_MS = 15_000;

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function parseTarget(value: unknown): AppealTargetSummary | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  const type = safeString(record.type);
  if (!id || !type) return null;
  return {
    id,
    type,
    title: safeString(record.title),
    authorName: safeString(record.authorName),
    status: safeString(record.status),
    storyId: safeString(record.storyId),
  };
}

function parseAppeal(value: unknown): Appeal | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  const targetId = safeString(record.targetId);
  if (!id || !targetId) return null;

  const targetType = record.targetType === 'COMMENT' ? 'COMMENT' : 'STORY';
  const status =
    record.status === 'ACCEPTED' || record.status === 'REJECTED' ? record.status : 'PENDING';

  return {
    id,
    targetType,
    targetId,
    reportId: safeString(record.reportId),
    message: typeof record.message === 'string' ? record.message : '',
    status,
    createdAt: safeString(record.createdAt) ?? new Date(0).toISOString(),
    resolvedAt: safeString(record.resolvedAt),
    resolutionNote: safeString(record.resolutionNote),
    target: parseTarget(record.target),
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
    return parsed === null
      ? { status: 'error', message: fallback }
      : { status: 'ok', data: parsed };
  } catch {
    return { status: 'error', message: fallback };
  }
}

/** Apela un contenido propio que está oculto por moderación. */
export function createAppeal(
  targetType: AppealTarget,
  targetId: string,
  message: string,
): Promise<LoadResult<Appeal>> {
  return request(
    '/appeals',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, message }),
    },
    'No se pudo enviar la apelación.',
    parseAppeal,
  );
}

/** Lista tus apelaciones, paginadas por cursor. */
export function listMyAppeals(
  params: { cursor?: string; status?: AppealStatus; limit?: number } = {},
): Promise<LoadResult<AppealPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));

  return request(
    `/appeals/mine?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar tus apelaciones.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items.map(parseAppeal).filter((item): item is Appeal => item !== null)
        : [];
      return {
        items,
        nextCursor: safeString(record.nextCursor),
      };
    },
  );
}
