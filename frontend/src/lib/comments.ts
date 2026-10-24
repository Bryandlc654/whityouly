import { API_URL } from './api';
import { authFetch } from './auth';
import { safeAvatarUrl } from './avatar';
import type { LoadResult } from './account';

export interface CommentAuthor {
  name: string;
  avatarUrl: string | null;
}

export interface StoryComment {
  id: string;
  content: string | null;
  deleted: boolean;
  parentId: string | null;
  author: CommentAuthor;
  isOwn: boolean;
  helpfulCount: number;
  helpfulByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentPage {
  items: StoryComment[];
  nextCursor: string | null;
  commentCount: number;
}

export const REPORT_REASONS = [
  'SPAM',
  'HARASSMENT',
  'OFFENSIVE',
  'SEXUAL',
  'THREATS',
  'IMPERSONATION',
  'ILLEGAL',
  'OTHER',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const REQUEST_TIMEOUT_MS = 15_000;

function parseComment(value: unknown): StoryComment | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  if (!id) return null;
  const authorRecord = (record.author ?? {}) as Record<string, unknown>;
  return {
    id,
    content: typeof record.content === 'string' ? record.content : null,
    deleted: record.deleted === true,
    parentId: typeof record.parentId === 'string' ? record.parentId : null,
    author: {
      name: typeof authorRecord.name === 'string' ? authorRecord.name : 'Anónimo',
      avatarUrl: safeAvatarUrl(authorRecord.avatarUrl),
    },
    isOwn: record.isOwn === true,
    helpfulCount:
      typeof record.helpfulCount === 'number' && Number.isFinite(record.helpfulCount)
        ? record.helpfulCount
        : 0,
    helpfulByMe: record.helpfulByMe === true,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
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
    return parsed === null ? { status: 'error', message: fallback } : { status: 'ok', data: parsed };
  } catch {
    return { status: 'error', message: fallback };
  }
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export interface CommentDraft {
  content: string;
  updatedAt: string | null;
}

function parseDraft(body: unknown): CommentDraft | null {
  const record = (body ?? {}) as Record<string, unknown>;
  if (typeof record.content !== 'string') return null;
  return {
    content: record.content,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  };
}

export function getCommentDraft(storyId: string): Promise<LoadResult<CommentDraft>> {
  return request(
    `/comments/story/${encodeURIComponent(storyId)}/draft`,
    { method: 'GET' },
    'No se pudo recuperar el borrador.',
    parseDraft,
  );
}

export function saveCommentDraft(
  storyId: string,
  content: string,
): Promise<LoadResult<CommentDraft>> {
  return request(
    `/comments/story/${encodeURIComponent(storyId)}/draft`,
    jsonInit('PUT', { content }),
    'No se pudo guardar el borrador.',
    parseDraft,
  );
}

export function deleteCommentDraft(
  storyId: string,
): Promise<LoadResult<{ deleted: boolean }>> {
  return request(
    `/comments/story/${encodeURIComponent(storyId)}/draft`,
    { method: 'DELETE' },
    'No se pudo eliminar el borrador.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return { deleted: record.deleted === true };
    },
  );
}

export function listComments(
  storyId: string,
  cursor?: string,
): Promise<LoadResult<CommentPage>> {
  const query = new URLSearchParams();
  if (cursor) query.set('cursor', cursor);

  return request(
    `/comments/story/${encodeURIComponent(storyId)}?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar los comentarios.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items
            .map(parseComment)
            .filter((item: StoryComment | null): item is StoryComment => item !== null)
        : [];
      return {
        items,
        nextCursor: typeof record.nextCursor === 'string' ? record.nextCursor : null,
        commentCount: typeof record.commentCount === 'number' ? record.commentCount : items.length,
      };
    },
  );
}

export function createComment(
  storyId: string,
  input: { content: string; parentId?: string },
): Promise<LoadResult<StoryComment>> {
  return request(
    `/comments/story/${encodeURIComponent(storyId)}`,
    jsonInit('POST', { content: input.content, parentId: input.parentId }),
    'No se pudo publicar el comentario.',
    parseComment,
  );
}

export function editComment(id: string, content: string): Promise<LoadResult<StoryComment>> {
  return request(
    `/comments/${encodeURIComponent(id)}`,
    jsonInit('PATCH', { content }),
    'No se pudo editar el comentario.',
    parseComment,
  );
}

export function deleteComment(id: string): Promise<LoadResult<{ id: string }>> {
  return request(
    `/comments/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'No se pudo eliminar el comentario.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return typeof record.id === 'string' ? { id: record.id } : null;
    },
  );
}

export function reportComment(id: string, reason: ReportReason): Promise<LoadResult<{ reported: boolean }>> {
  return request(
    `/comments/${encodeURIComponent(id)}/report`,
    jsonInit('POST', { reason }),
    'No se pudo reportar el comentario.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return { reported: record.reported === true };
    },
  );
}

/** Marca o desmarca un comentario como "Me ayudó" (alimenta las flores del árbol). */
export function toggleHelpful(
  id: string,
): Promise<LoadResult<{ helpful: boolean; count: number }>> {
  return request(
    `/comments/${encodeURIComponent(id)}/helpful`,
    { method: 'POST' },
    'No se pudo marcar el comentario.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return {
        helpful: record.helpful === true,
        count: typeof record.count === 'number' ? record.count : 0,
      };
    },
  );
}