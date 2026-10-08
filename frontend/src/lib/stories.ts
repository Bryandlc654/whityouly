import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

export type StoryVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
export type StoryStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'REPORTED' | 'MODERATED' | 'DELETED';

export interface StoryStage {
  id: string;
  content: string;
  mediaUrl: string | null;
  audioUrl: string | null;
  stageOrder: number;
  createdAt: string;
}

export interface StoryEmotion {
  name: string;
  colorHex: string | null;
}

export interface MyStory {
  id: string;
  title: string;
  visibility: StoryVisibility;
  status: StoryStatus;
  author: { name: string; avatarUrl: string | null } | null;
  categories: string[];
  emotions: StoryEmotion[];
  tags: string[];
  updates: StoryStage[];
  supportCount: number;
  commentCount: number;
  followerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MyStoryListItem {
  id: string;
  title: string;
  visibility: StoryVisibility;
  status: StoryStatus;
  categories: string[];
  emotions: StoryEmotion[];
  tags: string[];
  opening: StoryStage | null;
  stageCount: number;
  supportCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoryInput {
  title: string;
  content: string;
  visibility?: StoryVisibility;
  publish?: boolean;
  categories?: string[];
  emotions?: string[];
  tags?: string[];
  mediaAssetId?: string;
  audioAssetId?: string;
}

export interface UpdateStoryInput {
  title?: string;
  visibility?: StoryVisibility;
  categories?: string[];
  emotions?: string[];
  tags?: string[];
}

export interface StoryPage {
  items: MyStoryListItem[];
  nextCursor: string | null;
}

const REQUEST_TIMEOUT_MS = 15_000;

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

function parseStage(value: unknown): StoryStage | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  if (!id) return null;
  return {
    id,
    content: typeof record.content === 'string' ? record.content : '',
    mediaUrl: safeUrl(record.mediaUrl),
    audioUrl: safeUrl(record.audioUrl),
    stageOrder: typeof record.stageOrder === 'number' ? record.stageOrder : 0,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
  };
}

function parseEmotions(value: unknown): StoryEmotion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : null;
      if (!name) return null;
      return { name, colorHex: typeof record.colorHex === 'string' ? record.colorHex : null };
    })
    .filter((item): item is StoryEmotion => item !== null);
}

function parseNames(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseStory(value: unknown): MyStory | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const title = typeof record.title === 'string' ? record.title : null;
  if (!id || !title) return null;

  const authorRecord = (record.author ?? {}) as Record<string, unknown>;

  return {
    id,
    title,
    visibility: (record.visibility as StoryVisibility) ?? 'PUBLIC',
    status: (record.status as StoryStatus) ?? 'DRAFT',
    author:
      typeof authorRecord.name === 'string'
        ? { name: authorRecord.name, avatarUrl: safeUrl(authorRecord.avatarUrl) }
        : null,
    categories: parseNames(record.categories),
    emotions: parseEmotions(record.emotions),
    tags: parseNames(record.tags),
    updates: Array.isArray(record.updates)
      ? record.updates
          .map(parseStage)
          .filter((stage: StoryStage | null): stage is StoryStage => stage !== null)
      : [],
    supportCount: numberOr(record.supportCount),
    commentCount: numberOr(record.commentCount),
    followerCount: numberOr(record.followerCount),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
  };
}

function parseStoryListItem(value: unknown): MyStoryListItem | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const title = typeof record.title === 'string' ? record.title : null;
  if (!id || !title) return null;

  return {
    id,
    title,
    visibility: (record.visibility as StoryVisibility) ?? 'PUBLIC',
    status: (record.status as StoryStatus) ?? 'DRAFT',
    categories: parseNames(record.categories),
    emotions: parseEmotions(record.emotions),
    tags: parseNames(record.tags),
    opening: parseStage(record.opening),
    stageCount: numberOr(record.stageCount),
    supportCount: numberOr(record.supportCount),
    commentCount: numberOr(record.commentCount),
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

async function authedRequest<T>(
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

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function createStory(input: CreateStoryInput): Promise<LoadResult<MyStory>> {
  return authedRequest('/stories', jsonInit('POST', input), 'No se pudo publicar el relato.', (body) =>
    parseStory(body),
  );
}

export function listMyStories(params: {
  cursor?: string;
  status?: 'DRAFT' | 'PUBLISHED';
} = {}): Promise<LoadResult<StoryPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.status) query.set('status', params.status);

  return authedRequest(
    `/stories/me?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar tus relatos.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items
            .map(parseStoryListItem)
            .filter((item: MyStoryListItem | null): item is MyStoryListItem => item !== null)
        : [];
      return {
        items,
        nextCursor: typeof record.nextCursor === 'string' ? record.nextCursor : null,
      };
    },
  );
}

export function getMyStory(id: string): Promise<LoadResult<MyStory>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}`,
    { method: 'GET' },
    'No se pudo cargar el relato.',
    (body) => parseStory(body),
  );
}

/**
 * Detalle autenticado: sirve tanto para relatos públicos como para los que solo
 * ven los seguidores. La API decide si el relato es visible para el usuario.
 */
export function viewStory(id: string): Promise<LoadResult<MyStory>> {
  return authedRequest(
    `/stories/view/${encodeURIComponent(id)}`,
    { method: 'GET' },
    'No se pudo cargar el relato.',
    (body) => parseStory(body),
  );
}

export function updateStory(id: string, patch: UpdateStoryInput): Promise<LoadResult<MyStory>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}`,
    jsonInit('PATCH', patch),
    'No se pudieron guardar los cambios.',
    (body) => parseStory(body),
  );
}

export function addStoryStage(
  id: string,
  input: { content: string; mediaAssetId?: string; audioAssetId?: string },
): Promise<LoadResult<StoryStage>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}/updates`,
    jsonInit('POST', input),
    'No se pudo publicar la etapa.',
    (body) => parseStage(body),
  );
}

export function editStoryStage(
  id: string,
  updateId: string,
  input: { content?: string; mediaAssetId?: string | null; audioAssetId?: string | null },
): Promise<LoadResult<StoryStage>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}/updates/${encodeURIComponent(updateId)}`,
    jsonInit('PATCH', input),
    'No se pudo editar la etapa.',
    (body) => parseStage(body),
  );
}

export function deleteStoryStage(
  id: string,
  updateId: string,
): Promise<LoadResult<{ id: string }>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}/updates/${encodeURIComponent(updateId)}`,
    { method: 'DELETE' },
    'No se pudo eliminar la etapa.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return typeof record.id === 'string' ? { id: record.id } : null;
    },
  );
}

export function publishStory(id: string): Promise<LoadResult<MyStory>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}/publish`,
    { method: 'POST' },
    'No se pudo publicar el relato.',
    (body) => parseStory(body),
  );
}

export function unpublishStory(id: string): Promise<LoadResult<MyStory>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}/unpublish`,
    { method: 'POST' },
    'No se pudo volver a borrador.',
    (body) => parseStory(body),
  );
}

export function deleteStory(id: string): Promise<LoadResult<{ id: string }>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'No se pudo dar de baja el relato.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return typeof record.id === 'string' ? { id: record.id } : null;
    },
  );
}

export interface FollowingStory {
  id: string;
  title: string;
  author: { name: string; avatarUrl: string | null };
  categories: string[];
  emotions: StoryEmotion[];
  tags: string[];
  opening: StoryStage | null;
  stageCount: number;
  supportCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FollowingPage {
  items: FollowingStory[];
  nextCursor: string | null;
}

function parseFollowingStory(value: unknown): FollowingStory | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const title = typeof record.title === 'string' ? record.title : null;
  const authorRecord = (record.author ?? {}) as Record<string, unknown>;
  if (!id || !title || typeof authorRecord.name !== 'string') return null;

  return {
    id,
    title,
    author: { name: authorRecord.name, avatarUrl: safeUrl(authorRecord.avatarUrl) },
    categories: parseNames(record.categories),
    emotions: parseEmotions(record.emotions),
    tags: parseNames(record.tags),
    opening: parseStage(record.opening),
    stageCount: numberOr(record.stageCount),
    supportCount: numberOr(record.supportCount),
    commentCount: numberOr(record.commentCount),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
  };
}

function parseFollowingPage(body: unknown): FollowingPage {
  const record = (body ?? {}) as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items
        .map(parseFollowingStory)
        .filter((item: FollowingStory | null): item is FollowingStory => item !== null)
    : [];
  return {
    items,
    nextCursor: typeof record.nextCursor === 'string' ? record.nextCursor : null,
  };
}

/** Relatos publicados por los personajes que sigues (públicos y para seguidores). */
export function listFollowingStories(
  params: { cursor?: string } = {},
): Promise<LoadResult<FollowingPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);

  return authedRequest(
    `/stories/following?${query.toString()}`,
    { method: 'GET' },
    'No se pudo cargar tu feed de seguidos.',
    parseFollowingPage,
  );
}

/** Feed público (relatos publicados con visibilidad pública). */
export function listPublicStories(
  params: { cursor?: string; category?: string; emotion?: string; tag?: string } = {},
): Promise<LoadResult<FollowingPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.category) query.set('category', params.category);
  if (params.emotion) query.set('emotion', params.emotion);
  if (params.tag) query.set('tag', params.tag);

  return authedRequest(
    `/stories?${query.toString()}`,
    { method: 'GET' },
    'No se pudo cargar el feed.',
    parseFollowingPage,
  );
}
