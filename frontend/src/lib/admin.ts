import { API_URL } from './api';
import { authFetch } from './auth';

const STEP_UP_KEY = 'withyouly-admin-step-up';

/**
 * Petición administrativa con step-up. Si el backend pide confirmación MFA,
 * abre el diálogo global, obtiene un token breve y reintenta una vez.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const withStepUp = (token: string | null): RequestInit => ({
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { 'x-step-up': token } : {}),
    },
  });

  const stored =
    typeof window !== 'undefined' ? sessionStorage.getItem(STEP_UP_KEY) : null;
  const response = await authFetch(input, withStepUp(stored));

  if (response.status !== 403) {
    return response;
  }

  let body: { code?: string } | null = null;
  try {
    body = (await response.clone().json()) as { code?: string };
  } catch {
    /* sin cuerpo */
  }

  if (body?.code === 'MFA_ENROLL_REQUIRED') {
    window.dispatchEvent(new Event('withyouly:mfa-enroll-required'));
    return response;
  }

  if (body?.code !== 'STEP_UP_REQUIRED') {
    return response;
  }

  const token = await new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 120_000);
    window.dispatchEvent(
      new CustomEvent('withyouly:step-up-required', { detail: { resolve: finish } }),
    );
  });

  if (!token) {
    return response;
  }

  sessionStorage.setItem(STEP_UP_KEY, token);
  return authFetch(input, withStepUp(token));
}
import type { LoadResult } from './account';
import type { ReportStatus } from './moderation';
import type { SupportCategory, SupportStatus, SupportTicket } from './support';

export type AdminRole = 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPERADMIN';
export type AdminUserStatus = 'ACTIVE' | 'SUSPENDED';

export interface AdminUser {
  id: string;
  email: string;
  isEmailVerified: boolean;
  role: AdminRole;
  status: AdminUserStatus;
  createdAt: string;
  updatedAt: string;
  characterName: string | null;
  counts: {
    characters: number;
    stories: number;
    media: number;
    activeSessions: number;
  };
}

export interface AdminUserPage {
  items: AdminUser[];
  nextCursor: string | null;
}

export interface AdminOverview {
  users: {
    total: number;
    active: number;
    suspended: number;
    verified: number;
    byRole: Record<AdminRole, number>;
    newLast7Days: number;
  };
  content: {
    stories: number;
    publishedStories: number;
    comments: number;
    characters: number;
    media: { count: number; bytes: number };
  };
  moderation: {
    reportsPending: number;
    reportsInReview: number;
    appealsPending: number;
    actionsLast7Days: number;
  };
  support: {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
  recent: {
    users: Array<{
      id: string;
      email: string;
      role: string;
      status: string;
      createdAt: string;
    }>;
    actions: Array<{
      id: string;
      action: string;
      targetType: string | null;
      reason: string;
      createdAt: string;
      actorEmail: string | null;
      subjectEmail: string | null;
    }>;
  };
}

export interface CuratedFeatured {
  storyId: string;
  title: string;
  status: string;
  visibility: string;
  author: string;
  position: number;
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface AdminMediaFile {
  id: string;
  userId: string;
  userEmail: string | null;
  fileUrl: string;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  entityType: string;
  createdAt: string;
}

export interface AdminMediaPage {
  items: AdminMediaFile[];
  nextCursor: string | null;
}

export interface AdminSupportTicket extends SupportTicket {
  userId: string;
  userEmail: string | null;
  characterName: string | null;
}

export interface AdminSupportPage {
  items: AdminSupportTicket[];
  nextCursor: string | null;
}

const REQUEST_TIMEOUT_MS = 15_000;

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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
    response = await adminFetch(`${API_URL}${path}`, {
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

  if (response.status === 204) {
    return parse(null) as LoadResult<T>;
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

function parseAdminUser(value: unknown): AdminUser | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  const email = safeString(record.email);
  if (!id || !email) return null;

  const role =
    record.role === 'MODERATOR' || record.role === 'ADMIN' || record.role === 'SUPERADMIN'
      ? record.role
      : 'USER';
  const counts = (record.counts ?? {}) as Record<string, unknown>;

  return {
    id,
    email,
    isEmailVerified: record.isEmailVerified === true,
    role,
    status: record.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
    createdAt: safeString(record.createdAt) ?? new Date(0).toISOString(),
    updatedAt: safeString(record.updatedAt) ?? new Date(0).toISOString(),
    characterName: safeString(record.characterName),
    counts: {
      characters: numberOr(counts.characters),
      stories: numberOr(counts.stories),
      media: numberOr(counts.media),
      activeSessions: numberOr(counts.activeSessions),
    },
  };
}

export function listAdminUsers(
  params: {
    search?: string;
    role?: AdminRole;
    status?: AdminUserStatus;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<LoadResult<AdminUserPage>> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));

  return request(
    `/admin/users?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar los usuarios.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items.map(parseAdminUser).filter((item): item is AdminUser => item !== null)
        : [];
      return { items, nextCursor: safeString(record.nextCursor) };
    },
  );
}

export function updateAdminUserRole(
  id: string,
  role: AdminRole,
): Promise<LoadResult<AdminUser>> {
  return request(
    `/admin/users/${encodeURIComponent(id)}/role`,
    jsonInit('PATCH', { role }),
    'No se pudo cambiar el rol.',
    parseAdminUser,
  );
}

export function updateAdminUserStatus(
  id: string,
  status: AdminUserStatus,
): Promise<LoadResult<AdminUser>> {
  return request(
    `/admin/users/${encodeURIComponent(id)}/status`,
    jsonInit('PATCH', { status }),
    'No se pudo cambiar el estado de la cuenta.',
    parseAdminUser,
  );
}

export function fetchAdminOverview(): Promise<LoadResult<AdminOverview>> {
  return request('/admin/overview', { method: 'GET' }, 'No se pudieron cargar las métricas.', (body) => {
    const record = (body ?? {}) as Record<string, unknown>;
    if (!record.users || !record.content || !record.moderation || !record.support) return null;

    const users = record.users as Record<string, unknown>;
    const content = record.content as Record<string, unknown>;
    const moderation = record.moderation as Record<string, unknown>;
    const support = record.support as Record<string, unknown>;
    const byRole = (users.byRole ?? {}) as Record<string, unknown>;
    const media = (content.media ?? {}) as Record<string, unknown>;
    const recent = (record.recent ?? {}) as Record<string, unknown>;

    const recentUsers = Array.isArray(recent.users)
      ? recent.users
          .map((item) => {
            const row = (item ?? {}) as Record<string, unknown>;
            const id = safeString(row.id);
            const email = safeString(row.email);
            if (!id || !email) return null;
            return {
              id,
              email,
              role: safeString(row.role) ?? 'USER',
              status: safeString(row.status) ?? 'ACTIVE',
              createdAt: safeString(row.createdAt) ?? new Date(0).toISOString(),
            };
          })
          .filter((item): item is AdminOverview['recent']['users'][number] => item !== null)
      : [];

    const recentActions = Array.isArray(recent.actions)
      ? recent.actions
          .map((item) => {
            const row = (item ?? {}) as Record<string, unknown>;
            const id = safeString(row.id);
            if (!id) return null;
            return {
              id,
              action: safeString(row.action) ?? 'DISMISS',
              targetType: safeString(row.targetType),
              reason: typeof row.reason === 'string' ? row.reason : '',
              createdAt: safeString(row.createdAt) ?? new Date(0).toISOString(),
              actorEmail: safeString(row.actorEmail),
              subjectEmail: safeString(row.subjectEmail),
            };
          })
          .filter((item): item is AdminOverview['recent']['actions'][number] => item !== null)
      : [];

    return {
      users: {
        total: numberOr(users.total),
        active: numberOr(users.active),
        suspended: numberOr(users.suspended),
        verified: numberOr(users.verified),
        byRole: {
          USER: numberOr(byRole.USER),
          MODERATOR: numberOr(byRole.MODERATOR),
          ADMIN: numberOr(byRole.ADMIN),
          SUPERADMIN: numberOr(byRole.SUPERADMIN),
        },
        newLast7Days: numberOr(users.newLast7Days),
      },
      content: {
        stories: numberOr(content.stories),
        publishedStories: numberOr(content.publishedStories),
        comments: numberOr(content.comments),
        characters: numberOr(content.characters),
        media: { count: numberOr(media.count), bytes: numberOr(media.bytes) },
      },
      moderation: {
        reportsPending: numberOr(moderation.reportsPending),
        reportsInReview: numberOr(moderation.reportsInReview),
        appealsPending: numberOr(moderation.appealsPending),
        actionsLast7Days: numberOr(moderation.actionsLast7Days),
      },
      support: {
        open: numberOr(support.open),
        inProgress: numberOr(support.inProgress),
        resolved: numberOr(support.resolved),
        closed: numberOr(support.closed),
      },
      recent: { users: recentUsers, actions: recentActions },
    };
  });
}

function parseCurated(value: unknown): CuratedFeatured | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const storyId = safeString(record.storyId);
  const title = safeString(record.title);
  if (!storyId || !title) return null;

  return {
    storyId,
    title,
    status: safeString(record.status) ?? 'UNKNOWN',
    visibility: safeString(record.visibility) ?? 'PUBLIC',
    author: safeString(record.author) ?? '',
    position: numberOr(record.position),
    note: safeString(record.note),
    expiresAt: safeString(record.expiresAt),
    createdAt: safeString(record.createdAt) ?? new Date(0).toISOString(),
  };
}

export function updateAdminReportStatus(
  reportId: string,
  status: Extract<ReportStatus, 'PENDING' | 'IN_REVIEW'>,
): Promise<LoadResult<{ id: string; status: string }>> {
  return request(
    `/admin/reports/${encodeURIComponent(reportId)}`,
    jsonInit('PATCH', { status }),
    'No se pudo actualizar el reporte.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const id = safeString(record.id) ?? reportId;
      return { id, status: safeString(record.status) ?? status };
    },
  );
}

export function moderateAdminReportContent(
  reportId: string,
  action: 'HIDE' | 'RESTORE',
): Promise<LoadResult<{ id: string; action: 'HIDE' | 'RESTORE' }>> {
  return request(
    `/admin/reports/${encodeURIComponent(reportId)}/content`,
    jsonInit('PATCH', { action }),
    'No se pudo moderar el contenido.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const id = safeString(record.id) ?? reportId;
      return { id, action: record.action === 'RESTORE' ? 'RESTORE' : 'HIDE' };
    },
  );
}

export function listAdminFeatured(): Promise<LoadResult<{ items: CuratedFeatured[] }>> {  return request('/admin/featured', { method: 'GET' }, 'No se pudo cargar el contenido destacado.', (body) => {
    const record = (body ?? {}) as Record<string, unknown>;
    const items = Array.isArray(record.items)
      ? record.items
          .map(parseCurated)
          .filter((item): item is CuratedFeatured => item !== null)
      : [];
    return { items };
  });
}

export function featureStory(
  storyId: string,
  input: { position?: number; note?: string; expiresAt?: string | null },
): Promise<LoadResult<{ storyId: string }>> {
  return request(
    `/admin/featured/${encodeURIComponent(storyId)}`,
    jsonInit('PUT', input),
    'No se pudo destacar el relato.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const id = safeString(record.storyId) ?? storyId;
      return { storyId: id };
    },
  );
}

export function unfeatureStory(storyId: string): Promise<LoadResult<{ storyId: string }>> {
  return request(
    `/admin/featured/${encodeURIComponent(storyId)}`,
    { method: 'DELETE' },
    'No se pudo quitar el destacado.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      return { storyId: safeString(record.storyId) ?? storyId };
    },
  );
}

export interface AdminTaxonomyItem {
  id: string;
  name: string;
  colorHex?: string | null;
}

function parseCatalogItem(value: unknown, withColor = false): AdminTaxonomyItem | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  const name = safeString(record.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    colorHex: withColor ? safeString(record.colorHex) : null,
  };
}

function catalogRequest(
  path: string,
  init: RequestInit,
  fallback: string,
  withColor = false,
): Promise<LoadResult<AdminTaxonomyItem>> {
  return request(path, init, fallback, (body) => parseCatalogItem(body, withColor));
}

export function createCategory(name: string) {
  return catalogRequest('/admin/taxonomy/categories', jsonInit('POST', { name }), 'No se pudo crear la categoría.');
}

export function renameCategory(id: string, name: string) {
  return catalogRequest(
    `/admin/taxonomy/categories/${encodeURIComponent(id)}`,
    jsonInit('PATCH', { name }),
    'No se pudo renombrar la categoría.',
  );
}

export function deleteCategory(id: string) {
  return request(
    `/admin/taxonomy/categories/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'No se pudo eliminar la categoría.',
    () => ({ id }),
  );
}

export function createEmotion(name: string, colorHex?: string) {
  return catalogRequest(
    '/admin/taxonomy/emotions',
    jsonInit('POST', { name, ...(colorHex ? { colorHex } : {}) }),
    'No se pudo crear la emoción.',
    true,
  );
}

export function updateEmotion(id: string, input: { name?: string; colorHex?: string }) {
  return catalogRequest(
    `/admin/taxonomy/emotions/${encodeURIComponent(id)}`,
    jsonInit('PATCH', input),
    'No se pudo actualizar la emoción.',
    true,
  );
}

export function deleteEmotion(id: string) {
  return request(
    `/admin/taxonomy/emotions/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'No se pudo eliminar la emoción.',
    () => ({ id }),
  );
}

export function createTag(name: string) {
  return catalogRequest('/admin/taxonomy/tags', jsonInit('POST', { name }), 'No se pudo crear la etiqueta.');
}

export function renameTag(id: string, name: string) {
  return catalogRequest(
    `/admin/taxonomy/tags/${encodeURIComponent(id)}`,
    jsonInit('PATCH', { name }),
    'No se pudo renombrar la etiqueta.',
  );
}

export function deleteTag(id: string) {
  return request(
    `/admin/taxonomy/tags/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'No se pudo eliminar la etiqueta.',
    () => ({ id }),
  );
}

function safeUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? value : '';
  } catch {
    return '';
  }
}

function parseAdminFile(value: unknown): AdminMediaFile | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  const fileUrl = safeUrl(record.fileUrl);
  if (!id || !fileUrl) return null;

  return {
    id,
    userId: safeString(record.userId) ?? '',
    userEmail: safeString(record.userEmail),
    fileUrl,
    originalName: safeString(record.originalName),
    mimeType: safeString(record.mimeType),
    sizeBytes: typeof record.sizeBytes === 'number' ? record.sizeBytes : null,
    width: typeof record.width === 'number' ? record.width : null,
    height: typeof record.height === 'number' ? record.height : null,
    entityType: safeString(record.entityType) ?? 'NONE',
    createdAt: safeString(record.createdAt) ?? new Date(0).toISOString(),
  };
}

export function listAdminFiles(
  params: { userId?: string; cursor?: string; limit?: number } = {},
): Promise<LoadResult<AdminMediaPage>> {
  const query = new URLSearchParams();
  if (params.userId) query.set('userId', params.userId);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));

  return request(
    `/admin/files?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar los archivos.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items
            .map(parseAdminFile)
            .filter((item): item is AdminMediaFile => item !== null)
        : [];
      return { items, nextCursor: safeString(record.nextCursor) };
    },
  );
}

export function deleteAdminFile(id: string): Promise<LoadResult<{ id: string }>> {
  return request(
    `/admin/files/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    'No se pudo borrar el archivo.',
    () => ({ id }),
  );
}

function parseAdminSupportTicket(value: unknown): AdminSupportTicket | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  if (!id) return null;

  const category: SupportCategory =
    record.category === 'ACCOUNT' ||
    record.category === 'MODERATION' ||
    record.category === 'STORY' ||
    record.category === 'BUG' ||
    record.category === 'PRIVACY'
      ? record.category
      : 'OTHER';

  const status: SupportStatus =
    record.status === 'IN_PROGRESS' ||
    record.status === 'RESOLVED' ||
    record.status === 'CLOSED'
      ? record.status
      : 'OPEN';

  return {
    id,
    category,
    body: typeof record.body === 'string' ? record.body : '',
    status,
    resolutionNote: safeString(record.resolutionNote),
    createdAt: safeString(record.createdAt) ?? new Date(0).toISOString(),
    updatedAt: safeString(record.updatedAt) ?? new Date(0).toISOString(),
    resolvedAt: safeString(record.resolvedAt),
    userId: safeString(record.userId) ?? '',
    userEmail: safeString(record.userEmail),
    characterName: safeString(record.characterName),
  };
}

export function listAdminSupportTickets(
  params: {
    status?: SupportStatus;
    category?: SupportCategory;
    search?: string;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<LoadResult<AdminSupportPage>> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));

  return request(
    `/admin/support/tickets?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar las solicitudes.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items
            .map(parseAdminSupportTicket)
            .filter((item): item is AdminSupportTicket => item !== null)
        : [];
      return { items, nextCursor: safeString(record.nextCursor) };
    },
  );
}

export function updateAdminSupportTicket(
  id: string,
  input: { status?: SupportStatus; resolutionNote?: string },
): Promise<LoadResult<AdminSupportTicket>> {
  return request(
    `/admin/support/tickets/${encodeURIComponent(id)}`,
    jsonInit('PATCH', input),
    'No se pudo actualizar la solicitud.',
    parseAdminSupportTicket,
  );
}

export type AdminStoryStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'HIDDEN'
  | 'REPORTED'
  | 'MODERATED'
  | 'WITHDRAWN'
  | 'DELETED';

export type AdminCommentStatus = 'ACTIVE' | 'HIDDEN' | 'MODERATED' | 'DELETED';
export type ContentVisibilityAction = 'HIDE' | 'RESTORE';

export interface AdminStory {
  id: string;
  title: string;
  status: AdminStoryStatus;
  visibility: string;
  language: string;
  authorName: string;
  authorEmail: string;
  comments: number;
  stages: number;
  supports: number;
  createdAt: string;
  updatedAt: string;
  canHide: boolean;
  canRestore: boolean;
  canDelete: boolean;
}

export interface AdminStoryPage {
  items: AdminStory[];
  nextCursor: string | null;
}

export interface AdminComment {
  id: string;
  content: string;
  status: AdminCommentStatus;
  storyId: string;
  storyTitle: string;
  parentId: string | null;
  authorName: string;
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
  canHide: boolean;
  canRestore: boolean;
  canDelete: boolean;
}

export interface AdminCommentPage {
  items: AdminComment[];
  nextCursor: string | null;
}

const STORY_STATUSES: AdminStoryStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'HIDDEN',
  'REPORTED',
  'MODERATED',
  'WITHDRAWN',
  'DELETED',
];
const COMMENT_STATUSES: AdminCommentStatus[] = ['ACTIVE', 'HIDDEN', 'MODERATED', 'DELETED'];

function parseStoryStatus(value: unknown): AdminStoryStatus {
  return STORY_STATUSES.includes(value as AdminStoryStatus)
    ? (value as AdminStoryStatus)
    : 'DRAFT';
}

function parseCommentStatus(value: unknown): AdminCommentStatus {
  return COMMENT_STATUSES.includes(value as AdminCommentStatus)
    ? (value as AdminCommentStatus)
    : 'ACTIVE';
}

function parseAdminStory(value: unknown): AdminStory | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  const title = typeof record.title === 'string' ? record.title : '';
  if (!id) return null;
  return {
    id,
    title,
    status: parseStoryStatus(record.status),
    visibility: safeString(record.visibility) ?? 'PUBLIC',
    language: safeString(record.language) ?? 'es',
    authorName: safeString(record.authorName) ?? '',
    authorEmail: safeString(record.authorEmail) ?? '',
    comments: numberOr(record.comments),
    stages: numberOr(record.stages),
    supports: numberOr(record.supports),
    createdAt: safeString(record.createdAt) ?? new Date(0).toISOString(),
    updatedAt: safeString(record.updatedAt) ?? new Date(0).toISOString(),
    canHide: record.canHide === true,
    canRestore: record.canRestore === true,
    canDelete: record.canDelete !== false,
  };
}

function parseAdminComment(value: unknown): AdminComment | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  if (!id) return null;
  return {
    id,
    content: typeof record.content === 'string' ? record.content : '',
    status: parseCommentStatus(record.status),
    storyId: safeString(record.storyId) ?? '',
    storyTitle: safeString(record.storyTitle) ?? '',
    parentId: safeString(record.parentId),
    authorName: safeString(record.authorName) ?? '',
    authorEmail: safeString(record.authorEmail) ?? '',
    createdAt: safeString(record.createdAt) ?? new Date(0).toISOString(),
    updatedAt: safeString(record.updatedAt) ?? new Date(0).toISOString(),
    canHide: record.canHide === true,
    canRestore: record.canRestore === true,
    canDelete: record.canDelete !== false,
  };
}

export function listAdminStories(
  params: {
    search?: string;
    status?: AdminStoryStatus;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<LoadResult<AdminStoryPage>> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));

  return request(
    `/admin/content/stories?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar los relatos.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items.map(parseAdminStory).filter((item): item is AdminStory => item !== null)
        : [];
      return { items, nextCursor: safeString(record.nextCursor) };
    },
  );
}

export function setAdminStoryVisibility(
  id: string,
  action: ContentVisibilityAction,
  reason: string,
): Promise<LoadResult<{ id: string; status: string }>> {
  return request(
    `/admin/content/stories/${encodeURIComponent(id)}/visibility`,
    jsonInit('PATCH', { action, reason }),
    'No se pudo cambiar la visibilidad del relato.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const storyId = safeString(record.id);
      if (!storyId) return null;
      return { id: storyId, status: safeString(record.status) ?? '' };
    },
  );
}

export function deleteAdminStory(
  id: string,
  reason: string,
): Promise<LoadResult<{ id: string }>> {
  return request(
    `/admin/content/stories/${encodeURIComponent(id)}`,
    jsonInit('DELETE', { reason }),
    'No se pudo eliminar el relato.',
    () => ({ id }),
  );
}

export function listAdminComments(
  params: {
    search?: string;
    status?: AdminCommentStatus;
    storyId?: string;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<LoadResult<AdminCommentPage>> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.storyId) query.set('storyId', params.storyId);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));

  return request(
    `/admin/content/comments?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar los comentarios.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const items = Array.isArray(record.items)
        ? record.items.map(parseAdminComment).filter((item): item is AdminComment => item !== null)
        : [];
      return { items, nextCursor: safeString(record.nextCursor) };
    },
  );
}

export function setAdminCommentVisibility(
  id: string,
  action: ContentVisibilityAction,
  reason: string,
): Promise<LoadResult<{ id: string; status: string }>> {
  return request(
    `/admin/content/comments/${encodeURIComponent(id)}/visibility`,
    jsonInit('PATCH', { action, reason }),
    'No se pudo cambiar la visibilidad del comentario.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const commentId = safeString(record.id);
      if (!commentId) return null;
      return { id: commentId, status: safeString(record.status) ?? '' };
    },
  );
}

export function deleteAdminComment(
  id: string,
  reason: string,
): Promise<LoadResult<{ id: string }>> {
  return request(
    `/admin/content/comments/${encodeURIComponent(id)}`,
    jsonInit('DELETE', { reason }),
    'No se pudo eliminar el comentario.',
    () => ({ id }),
  );
}
