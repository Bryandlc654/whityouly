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
export type ReportStatus = 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
export type ModerationDecision = 'DISMISS' | 'HIDE' | 'SUSPEND';
export type ModerationActionKind = 'DISMISS' | 'HIDE' | 'SUSPEND' | 'RESTORE';

export interface AppealTargetSummary {
  id: string;
  type: string;
  title: string | null;
  authorName: string | null;
  status: string | null;
  storyId: string | null;
  context: string | null;
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
  appellantCharacterName: string | null;
  target: AppealTargetSummary | null;
}

export interface AppealPage {
  items: Appeal[];
  nextCursor: string | null;
}

export interface AdminReport {
  id: string;
  reportedType: string;
  reportedId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  reporterCharacterName: string | null;
  target: AppealTargetSummary | null;
}

export interface AdminReportPage {
  items: AdminReport[];
  nextCursor: string | null;
}

export interface ModerationAction {
  id: string;
  reportId: string | null;
  action: ModerationActionKind;
  targetType: string | null;
  targetId: string | null;
  reason: string;
  createdAt: string;
  revertedAt: string | null;
  revertReason: string | null;
  actorCharacterName: string | null;
  revertedByCharacterName: string | null;
  target: AppealTargetSummary | null;
  canRevert: boolean;
}

export interface ModerationActionPage {
  items: ModerationAction[];
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
    context: safeString(record.context),
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
    appellantCharacterName: safeString(record.appellantCharacterName),
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

function parseReport(value: unknown): AdminReport | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  const reportedId = safeString(record.reportedId);
  const reportedType = safeString(record.reportedType);
  if (!id || !reportedId || !reportedType) return null;

  const rawStatus = safeString(record.status);
  const status: ReportStatus =
    rawStatus === 'IN_REVIEW' || rawStatus === 'RESOLVED' || rawStatus === 'REJECTED'
      ? rawStatus
      : 'PENDING';

  return {
    id,
    reportedType,
    reportedId,
    reason: typeof record.reason === 'string' ? record.reason : '',
    status,
    createdAt: safeString(record.createdAt) ?? new Date(0).toISOString(),
    resolvedAt: safeString(record.resolvedAt),
    reporterCharacterName: safeString(record.reporterCharacterName),
    target: parseTarget(record.target),
  };
}

function parseAction(value: unknown): ModerationAction | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = safeString(record.id);
  const rawAction = safeString(record.action);
  if (
    !id ||
    (rawAction !== 'DISMISS' &&
      rawAction !== 'HIDE' &&
      rawAction !== 'SUSPEND' &&
      rawAction !== 'RESTORE')
  ) {
    return null;
  }

  return {
    id,
    reportId: safeString(record.reportId),
    action: rawAction,
    targetType: safeString(record.targetType),
    targetId: safeString(record.targetId),
    reason: typeof record.reason === 'string' ? record.reason : '',
    createdAt: safeString(record.createdAt) ?? new Date(0).toISOString(),
    revertedAt: safeString(record.revertedAt),
    revertReason: safeString(record.revertReason),
    actorCharacterName: safeString(record.actorCharacterName),
    revertedByCharacterName: safeString(record.revertedByCharacterName),
    target: parseTarget(record.target),
    canRevert: record.canRevert === true,
  };
}

function parseReportPage(body: unknown): AdminReportPage {
  const record = (body ?? {}) as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items.map(parseReport).filter((item): item is AdminReport => item !== null)
    : [];
  return { items, nextCursor: safeString(record.nextCursor) };
}

function parseActionPage(body: unknown): ModerationActionPage {
  const record = (body ?? {}) as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items
        .map(parseAction)
        .filter((item): item is ModerationAction => item !== null)
    : [];
  return { items, nextCursor: safeString(record.nextCursor) };
}

function parseAppealPage(body: unknown): AppealPage {
  const record = (body ?? {}) as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items.map(parseAppeal).filter((item): item is Appeal => item !== null)
    : [];
  return { items, nextCursor: safeString(record.nextCursor) };
}

export function listAdminReports(
  params: { cursor?: string; status?: ReportStatus; type?: string; limit?: number } = {},
): Promise<LoadResult<AdminReportPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.status) query.set('status', params.status);
  if (params.type) query.set('type', params.type);
  if (params.limit) query.set('limit', String(params.limit));

  return request(
    `/admin/reports?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar los reportes.',
    parseReportPage,
  );
}

export function createModerationDecision(
  reportId: string,
  input: { action: ModerationDecision; reason: string },
): Promise<LoadResult<{ id: string; reportId: string; action: ModerationDecision }>> {
  return request(
    `/admin/reports/${encodeURIComponent(reportId)}/decision`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'No se pudo aplicar la decisión.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const id = safeString(record.id);
      if (!id) return null;
      return {
        id,
        reportId: safeString(record.reportId) ?? reportId,
        action: input.action,
      };
    },
  );
}

export function listModerationActions(
  params: {
    cursor?: string;
    action?: ModerationActionKind;
    reportId?: string;
    status?: 'ALL' | 'ACTIVE' | 'REVERTED';
    limit?: number;
  } = {},
): Promise<LoadResult<ModerationActionPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.action) query.set('action', params.action);
  if (params.reportId) query.set('reportId', params.reportId);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));

  return request(
    `/admin/moderation/actions?${query.toString()}`,
    { method: 'GET' },
    'No se pudo cargar el historial de moderación.',
    parseActionPage,
  );
}

export function revertModerationAction(
  actionId: string,
  reason: string,
): Promise<LoadResult<{ id: string; revertedAt: string | null; reportId: string | null }>> {
  return request(
    `/admin/moderation/actions/${encodeURIComponent(actionId)}/revert`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
    'No se pudo revertir la decisión.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const id = safeString(record.id);
      if (!id) return null;
      return {
        id,
        revertedAt: safeString(record.revertedAt),
        reportId: safeString(record.reportId),
      };
    },
  );
}

export function listAdminAppeals(
  params: { cursor?: string; status?: AppealStatus; limit?: number } = {},
): Promise<LoadResult<AppealPage>> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));

  return request(
    `/admin/appeals?${query.toString()}`,
    { method: 'GET' },
    'No se pudieron cargar las apelaciones.',
    parseAppealPage,
  );
}

export function resolveAdminAppeal(
  appealId: string,
  input: { status: 'ACCEPTED' | 'REJECTED'; resolutionNote?: string },
): Promise<LoadResult<{ id: string; status: 'ACCEPTED' | 'REJECTED' }>> {
  return request(
    `/admin/appeals/${encodeURIComponent(appealId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'No se pudo resolver la apelación.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const id = safeString(record.id);
      if (!id) return null;
      return {
        id,
        status: record.status === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED',
      };
    },
  );
}
