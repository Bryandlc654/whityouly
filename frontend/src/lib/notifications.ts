import { API_URL } from './api';
import { authFetch } from './auth';
import { safeAvatarUrl } from './avatar';
import type { LoadResult } from './account';

export type NotificationStatus = 'UNREAD' | 'READ';

export interface NotificationItem {
  id: string;
  type: string;
  status: NotificationStatus;
  entityType: string;
  entityId: string | null;
  /** CuÃ¡ntos eventos agrupa (1 = aviso individual). */
  count: number;
  createdAt: string;
  actor: { name: string; avatarUrl: string | null } | null;
  story: {
    id: string;
    title: string;
    author: { name: string; avatarUrl: string | null } | null;
  } | null;
}

export interface NotificationsPage {
  items: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
}

const REQUEST_TIMEOUT_MS = 10_000;

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

function parseItem(value: unknown): NotificationItem | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const type = typeof record.type === 'string' ? record.type : null;
  if (!id || !type) return null;

  const actorRecord = (record.actor ?? {}) as Record<string, unknown>;
  const storyRecord = (record.story ?? {}) as Record<string, unknown> | null;

  return {
    id,
    type,
    status: record.status === 'READ' ? 'READ' : 'UNREAD',
    entityType: typeof record.entityType === 'string' ? record.entityType : 'SYSTEM',
    entityId: typeof record.entityId === 'string' ? record.entityId : null,
    count:
      typeof record.count === 'number' && Number.isFinite(record.count) && record.count > 0
        ? Math.floor(record.count)
        : 1,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    actor:
      typeof actorRecord.name === 'string'
        ? { name: actorRecord.name, avatarUrl: safeAvatarUrl(actorRecord.avatarUrl) }
        : null,
    story: storyRecord && typeof storyRecord.id === 'string' && typeof storyRecord.title === 'string'
      ? {
          id: storyRecord.id,
          title: storyRecord.title,
          author:
            typeof (storyRecord.author as Record<string, unknown>)?.name === 'string'
              ? {
                  name: (storyRecord.author as Record<string, unknown>).name as string,
                  avatarUrl: safeAvatarUrl(
                    (storyRecord.author as Record<string, unknown>).avatarUrl,
                  ),
                }
              : null,
        }
      : null,
  };
}

function parsePage(body: unknown): NotificationsPage | null {
  const record = (body ?? {}) as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items
        .map(parseItem)
        .filter((item: NotificationItem | null): item is NotificationItem => item !== null)
    : [];
  return {
    items,
    nextCursor: typeof record.nextCursor === 'string' ? record.nextCursor : null,
    unreadCount:
      typeof record.unreadCount === 'number' && Number.isFinite(record.unreadCount)
        ? record.unreadCount
        : 0,
  };
}

export function listNotifications(params: {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
} = {}): Promise<LoadResult<NotificationsPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.unreadOnly) query.set('unreadOnly', 'true');

  return request(
    `/notifications?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar las notificaciones.',
    parsePage,
  );
}

export function unreadNotificationsCount(): Promise<LoadResult<{ count: number }>> {
  return request(
    '/notifications/unread-count',
    { method: 'GET' },
    'No se pudo comprobar las notificaciones.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return typeof record.count === 'number' && Number.isFinite(record.count)
        ? { count: record.count }
        : { count: 0 };
    },
  );
}

export function markNotificationRead(id: string): Promise<LoadResult<{ id: string; status: 'READ' }>> {
  return request(
    `/notifications/${encodeURIComponent(id)}/read`,
    { method: 'POST' },
    'No se pudo marcar la notificaciÃ³n.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return typeof record.id === 'string' ? { id: record.id, status: 'READ' as const } : null;
    },
  );
}

export function markAllNotificationsRead(): Promise<LoadResult<{ updated: number }>> {
  return request(
    '/notifications/read-all',
    { method: 'POST' },
    'No se pudieron marcar las notificaciones.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return typeof record.updated === 'number' ? { updated: record.updated } : null;
    },
  );
}