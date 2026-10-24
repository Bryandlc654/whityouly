import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

export type SupportCategory =
  | 'ACCOUNT'
  | 'MODERATION'
  | 'STORY'
  | 'BUG'
  | 'PRIVACY'
  | 'OTHER';

export type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  'ACCOUNT',
  'MODERATION',
  'STORY',
  'BUG',
  'PRIVACY',
  'OTHER',
];

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  ACCOUNT: 'Cuenta y acceso',
  MODERATION: 'Moderación o reportes',
  STORY: 'Relatos o comentarios',
  BUG: 'Error técnico',
  PRIVACY: 'Privacidad y datos',
  OTHER: 'Otro motivo',
};

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En revisión',
  RESOLVED: 'Resuelta',
  CLOSED: 'Cerrada',
};

export const SUPPORT_BODY_MIN_LENGTH = 10;
export const SUPPORT_BODY_MAX_LENGTH = 3000;

export interface SupportTicket {
  id: string;
  category: SupportCategory;
  body: string;
  status: SupportStatus;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface SupportTicketPage {
  items: SupportTicket[];
  nextCursor: string | null;
}

const REQUEST_TIMEOUT_MS = 15_000;

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function parseCategory(value: unknown): SupportCategory {
  return SUPPORT_CATEGORIES.includes(value as SupportCategory)
    ? (value as SupportCategory)
    : 'OTHER';
}

function parseStatus(value: unknown): SupportStatus {
  if (value === 'IN_PROGRESS' || value === 'RESOLVED' || value === 'CLOSED') {
    return value;
  }
  return 'OPEN';
}

function parseTicket(value: unknown): SupportTicket | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  if (!id) return null;

  return {
    id,
    category: parseCategory(record.category),
    body: typeof record.body === 'string' ? record.body : '',
    status: parseStatus(record.status),
    resolutionNote: safeString(record.resolutionNote),
    createdAt: safeString(record.createdAt) ?? new Date(0).toISOString(),
    updatedAt: safeString(record.updatedAt) ?? new Date(0).toISOString(),
    resolvedAt: safeString(record.resolvedAt),
  };
}

function messageFrom(body: unknown, fallback: string): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message.trim() !== '') return message;
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

export function createSupportTicket(input: {
  category: SupportCategory;
  body: string;
}): Promise<LoadResult<SupportTicket>> {
  return request(
    '/support/tickets',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'No se pudo enviar la solicitud.',
    parseTicket,
  );
}

export function listMySupportTickets(
  params: { cursor?: string; status?: SupportStatus; limit?: number } = {},
): Promise<LoadResult<SupportTicketPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));

  return request(
    `/support/tickets/mine?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar tus solicitudes.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items
            .map(parseTicket)
            .filter((item): item is SupportTicket => item !== null)
        : [];
      return { items, nextCursor: safeString(record.nextCursor) };
    },
  );
}
