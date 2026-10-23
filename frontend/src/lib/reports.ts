import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

export type MyReportStatus = 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
export type MyReportAction = 'DISMISS' | 'HIDE' | 'SUSPEND' | 'RESTORE';

export interface MyReportTarget {
  type: string;
  title: string | null;
  authorName: string | null;
  status: string | null;
}

export interface MyReport {
  id: string;
  reportedType: string;
  reason: string;
  status: MyReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  action: MyReportAction | null;
  target: MyReportTarget | null;
}

export interface MyReportsPage {
  items: MyReport[];
  nextCursor: string | null;
}

const REQUEST_TIMEOUT_MS = 12_000;

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function parseTarget(value: unknown): MyReportTarget | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const type = safeString(record.type);
  if (!type) return null;

  return {
    type,
    title: safeString(record.title),
    authorName: safeString(record.authorName),
    status: safeString(record.status),
  };
}

function parseAction(value: unknown): MyReportAction | null {
  if (
    value === 'DISMISS' ||
    value === 'HIDE' ||
    value === 'SUSPEND' ||
    value === 'RESTORE'
  ) {
    return value;
  }
  return null;
}

function parseReport(value: unknown): MyReport | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  const reason = typeof record.reason === 'string' ? record.reason : '';
  if (!id) return null;

  const rawStatus = safeString(record.status);
  const status: MyReportStatus =
    rawStatus === 'IN_REVIEW' || rawStatus === 'RESOLVED' || rawStatus === 'REJECTED'
      ? rawStatus
      : 'PENDING';

  return {
    id,
    reportedType: safeString(record.reportedType) ?? 'STORY',
    reason,
    status,
    createdAt: safeString(record.createdAt) ?? new Date(0).toISOString(),
    resolvedAt: safeString(record.resolvedAt),
    resolution: safeString(record.resolution),
    action: parseAction(record.action),
    target: parseTarget(record.target),
  };
}

function parsePage(body: unknown): MyReportsPage {
  const record = (body ?? {}) as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items.map(parseReport).filter((item): item is MyReport => item !== null)
    : [];

  return {
    items,
    nextCursor: safeString(record.nextCursor),
  };
}

function messageFrom(body: unknown, fallback: string): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message.trim() !== '') return message;
  return fallback;
}

/** Seguimiento de los reportes enviados por la persona autenticada. */
export async function listMyReports(
  params: { cursor?: string; status?: MyReportStatus; limit?: number } = {},
): Promise<LoadResult<MyReportsPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));

  let response: Response;

  try {
    response = await authFetch(`${API_URL}/reports/mine?${query.toString()}`, {
      method: 'GET',
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
    return {
      status: 'error',
      message: messageFrom(body, 'No se pudieron cargar tus reportes.'),
    };
  }

  try {
    return { status: 'ok', data: parsePage(await response.json()) };
  } catch {
    return { status: 'error', message: 'No se pudieron cargar tus reportes.' };
  }
}
