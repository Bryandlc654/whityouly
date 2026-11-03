import { API_URL } from './api';
import { authFetch } from './auth';
import { safeAvatarUrl } from './avatar';
import type { ReportReason } from './comments';
import type { LoadResult } from './account';
import { parseVisualCardTheme, type VisualCardTheme } from './visualCards';

export type StoryVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
export type StoryStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'HIDDEN'
  | 'REPORTED'
  | 'MODERATED'
  | 'WITHDRAWN'
  | 'DELETED';

export interface StoryTranslation {
  title: string;
  content: string;
}

export type StoryTranslations = Record<string, StoryTranslation>;

export interface StoryStage {
  id: string;
  content: string;
  mediaUrl: string | null;
  audioUrl: string | null;
  transcript: string | null;
  updateKind: string | null;
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
  language: string;
  countryCode: string | null;
  translations: StoryTranslations | null;
  visualCardTheme: VisualCardTheme | null;
  contentWarning: string | null;
  musicLabel: string | null;
  externalShare: boolean;
  guestReadable: boolean;
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
  withdrawnAt: string | null;
  commentsPaused: boolean;
  /** La API devuelve una ficha sin contenido cuando el autor retirÃ³ el relato. */
  withdrawn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MyStoryListItem {
  id: string;
  title: string;
  language: string;
  countryCode: string | null;
  translations: StoryTranslations | null;
  visualCardTheme: VisualCardTheme | null;
  contentWarning: string | null;
  musicLabel: string | null;
  externalShare: boolean;
  guestReadable: boolean;
  visibility: StoryVisibility;
  status: StoryStatus;
  featuredAt: string | null;
  categories: string[];
  emotions: StoryEmotion[];
  tags: string[];
  opening: StoryStage | null;
  stageCount: number;
  supportCount: number;
  commentCount: number;
  withdrawnAt: string | null;
  commentsPaused: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoryInput {
  title: string;
  content: string;
  language?: string;
  countryCode?: string | null;
  visibility?: StoryVisibility;
  visualCardTheme?: VisualCardTheme | null;
  contentWarning?: string | null;
  musicLabel?: string | null;
  externalShare?: boolean;
  guestReadable?: boolean;
  publish?: boolean;
  categories?: string[];
  emotions?: string[];
  tags?: string[];
  mediaAssetId?: string;
  audioAssetId?: string;
  audioTranscript?: string;
}

export interface UpdateStoryInput {
  title?: string;
  language?: string;
  countryCode?: string | null;
  visibility?: StoryVisibility;
  visualCardTheme?: VisualCardTheme | null;
  contentWarning?: string | null;
  musicLabel?: string | null;
  externalShare?: boolean;
  guestReadable?: boolean;
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
    transcript: typeof record.transcript === 'string' ? record.transcript : null,
    updateKind: typeof record.updateKind === 'string' ? record.updateKind : null,
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
    language: typeof record.language === 'string' ? record.language : 'es',
    countryCode: typeof record.countryCode === 'string' ? record.countryCode : null,
    translations: parseTranslations(record.translations),
    visualCardTheme: parseVisualCardTheme(record.visualCardTheme),
    contentWarning: typeof record.contentWarning === 'string' ? record.contentWarning : null,
    musicLabel: typeof record.musicLabel === 'string' ? record.musicLabel : null,
    externalShare: record.externalShare !== false,
    guestReadable: record.guestReadable !== false,
    visibility: (record.visibility as StoryVisibility) ?? 'PUBLIC',
    status: (record.status as StoryStatus) ?? 'DRAFT',
    author:
      typeof authorRecord.name === 'string'
        ? { name: authorRecord.name, avatarUrl: safeAvatarUrl(authorRecord.avatarUrl) }
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
    withdrawnAt: typeof record.withdrawnAt === 'string' ? record.withdrawnAt : null,
    commentsPaused: record.commentsPaused === true,
    withdrawn: record.withdrawn === true,
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
    language: typeof record.language === 'string' ? record.language : 'es',
    countryCode: typeof record.countryCode === 'string' ? record.countryCode : null,
    translations: parseTranslations(record.translations),
    visualCardTheme: parseVisualCardTheme(record.visualCardTheme),
    contentWarning: typeof record.contentWarning === 'string' ? record.contentWarning : null,
    musicLabel: typeof record.musicLabel === 'string' ? record.musicLabel : null,
    externalShare: record.externalShare !== false,
    guestReadable: record.guestReadable !== false,
    visibility: (record.visibility as StoryVisibility) ?? 'PUBLIC',
    status: (record.status as StoryStatus) ?? 'DRAFT',
    featuredAt: typeof record.featuredAt === 'string' ? record.featuredAt : null,
    categories: parseNames(record.categories),
    emotions: parseEmotions(record.emotions),
    tags: parseNames(record.tags),
    opening: parseStage(record.opening),
    stageCount: numberOr(record.stageCount),
    supportCount: numberOr(record.supportCount),
    commentCount: numberOr(record.commentCount),
    withdrawnAt: typeof record.withdrawnAt === 'string' ? record.withdrawnAt : null,
    commentsPaused: record.commentsPaused === true,
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

function parseStoryPage(body: unknown): StoryPage {
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
    parseStoryPage,
  );
}

/** Relatos propios retirados, listos para restaurar o eliminar definitivamente. */
export function listWithdrawnStories(
  params: { cursor?: string } = {},
): Promise<LoadResult<StoryPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);

  return authedRequest(
    `/stories/me/withdrawn?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar tus relatos retirados.',
    parseStoryPage,
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
 * Detalle autenticado: sirve tanto para relatos pÃºblicos como para los que solo
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

/** Lectura de un enlace público sin sesión, si el autor lo permitió. */
export async function viewPublicStory(id: string): Promise<LoadResult<MyStory>> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/stories/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { status: 'error', message: 'No se pudo cargar el relato.' };
  }

  if (!response.ok) {
    return { status: 'error', message: 'Ese relato no existe o no está disponible.' };
  }

  const parsed = parseStory(await response.json().catch(() => null));
  return parsed
    ? { status: 'ok', data: parsed }
    : { status: 'error', message: 'La respuesta del servidor no se pudo leer.' };
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
  input: { content: string; mediaAssetId?: string; audioAssetId?: string; transcript?: string; updateKind?: string },
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
  input: {
    content?: string;
    mediaAssetId?: string | null;
    audioAssetId?: string | null;
    transcript?: string | null;
  },
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

/** Destaca/quita de destacadas un relato propio en el perfil pÃºblico. */
export function featureStory(id: string): Promise<LoadResult<MyStory>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}/feature`,
    { method: 'POST' },
    'No se pudo destacar el relato.',
    parseStory,
  );
}

export function unfeatureStory(id: string): Promise<LoadResult<MyStory>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}/feature`,
    { method: 'DELETE' },
    'No se pudo quitar el destacado.',
    parseStory,
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

export function pauseStoryComments(id: string): Promise<LoadResult<MyStory>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}/comments/pause`,
    { method: 'POST' },
    'No se pudieron pausar los comentarios.',
    (body) => parseStory(body),
  );
}

export function resumeStoryComments(id: string): Promise<LoadResult<MyStory>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}/comments/pause`,
    { method: 'DELETE' },
    'No se pudieron reabrir los comentarios.',
    (body) => parseStory(body),
  );
}

/** Retira un relato sin borrarlo; se conserva para poder restaurarlo. */
export function withdrawStory(id: string): Promise<LoadResult<MyStory>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}/withdraw`,
    { method: 'POST' },
    'No se pudo retirar el relato.',
    (body) => parseStory(body),
  );
}

export function restoreStory(id: string): Promise<LoadResult<MyStory>> {
  return authedRequest(
    `/stories/me/${encodeURIComponent(id)}/restore`,
    { method: 'POST' },
    'No se pudo restaurar el relato.',
    (body) => parseStory(body),
  );
}

/**
 * Reporta un relato ajeno. La API rechaza auto-reportes y reportes duplicados,
 * asÃ­ que el mensaje de error se muestra tal cual llega.
 */
export function reportStory(
  id: string,
  reason: ReportReason,
): Promise<LoadResult<{ reported: boolean }>> {
  return authedRequest(
    `/stories/${encodeURIComponent(id)}/report`,
    jsonInit('POST', { reason }),
    'No se pudo reportar el relato.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return { reported: record.reported === true };
    },
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
  language: string;
  countryCode: string | null;
  translations: StoryTranslations | null;
  visualCardTheme: VisualCardTheme | null;
  contentWarning: string | null;
  musicLabel: string | null;
  externalShare: boolean;
  guestReadable: boolean;
  author: { name: string; avatarUrl: string | null };
  categories: string[];
  emotions: StoryEmotion[];
  tags: string[];
  opening: StoryStage | null;
  stageCount: number;
  supportCount: number;
  commentCount: number;
  commentsPaused: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FollowingPage {
  items: FollowingStory[];
  nextCursor: string | null;
}

function parseTranslations(value: unknown): StoryTranslations | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result: StoryTranslations = {};
  for (const [language, translation] of Object.entries(value as Record<string, unknown>)) {
    if (!translation || typeof translation !== 'object' || Array.isArray(translation)) continue;
    const record = translation as Record<string, unknown>;
    if (typeof record.title !== 'string' || typeof record.content !== 'string') continue;
    result[language] = { title: record.title, content: record.content };
  }
  return Object.keys(result).length > 0 ? result : null;
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
    language: typeof record.language === 'string' ? record.language : 'es',
    countryCode: typeof record.countryCode === 'string' ? record.countryCode : null,
    translations: parseTranslations(record.translations),
    visualCardTheme: parseVisualCardTheme(record.visualCardTheme),
    contentWarning: typeof record.contentWarning === 'string' ? record.contentWarning : null,
    musicLabel: typeof record.musicLabel === 'string' ? record.musicLabel : null,
    externalShare: record.externalShare !== false,
    guestReadable: record.guestReadable !== false,
    author: { name: authorRecord.name, avatarUrl: safeAvatarUrl(authorRecord.avatarUrl) },
    categories: parseNames(record.categories),
    emotions: parseEmotions(record.emotions),
    tags: parseNames(record.tags),
    opening: parseStage(record.opening),
    stageCount: numberOr(record.stageCount),
    supportCount: numberOr(record.supportCount),
    commentCount: numberOr(record.commentCount),
    commentsPaused: record.commentsPaused === true,
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

/** Relatos publicados por los personajes que sigues (pÃºblicos y para seguidores). */
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

function parseFeedSection(value: unknown): FollowingStory[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseFollowingStory)
    .filter((item: FollowingStory | null): item is FollowingStory => item !== null);
}

/** Feed principal unificado (requiere sesiÃ³n): el algoritmo ordena todo el contenido por relevancia. */
export function getFeed(): Promise<LoadResult<{ items: FollowingStory[] }>> {
  return authedRequest(
    '/feed',
    { method: 'GET' },
    'No se pudo cargar el feed.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return { items: parseFeedSection(record.items) };
    },
  );
}

/** Feed pÃºblico (relatos publicados con visibilidad pÃºblica). */
export function listPublicStories(
  params: { cursor?: string; q?: string; category?: string; emotion?: string; tag?: string; countryCode?: string } = {},
): Promise<LoadResult<FollowingPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.q) query.set('q', params.q);
  if (params.category) query.set('category', params.category);
  if (params.emotion) query.set('emotion', params.emotion);
  if (params.tag) query.set('tag', params.tag);
  if (params.countryCode) query.set('countryCode', params.countryCode);

  return authedRequest(
    `/stories?${query.toString()}`,
    { method: 'GET' },
    'No se pudo cargar el feed.',
    parseFollowingPage,
  );
}
