import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

export type CareActivityType = 'BREATHING' | 'UNRAVEL' | 'SMALL_STEP' | 'VENT' | 'COMPANY' | 'DISTRACT';
export type CareActivityStatus = 'PLANNED' | 'COMPLETED';
export type CareOutcome = 'better' | 'same' | 'worse' | 'unsure';

export interface CareActivity {
  id: string;
  activity: CareActivityType;
  status: CareActivityStatus;
  reflection: string | null;
  outcome: CareOutcome | null;
  metadata: Record<string, unknown> | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  treeDropAwarded?: boolean;
}

export interface CreateCareActivityInput {
  activity: CareActivityType;
  status?: CareActivityStatus;
  reflection?: string;
  outcome?: CareOutcome;
  metadata?: Record<string, unknown>;
}

export interface UpdateCareActivityInput {
  status?: CareActivityStatus;
  reflection?: string;
  outcome?: CareOutcome;
  metadata?: Record<string, unknown>;
}

const REQUEST_TIMEOUT_MS = 15_000;
const ACTIVITIES: CareActivityType[] = ['BREATHING', 'UNRAVEL', 'SMALL_STEP', 'VENT', 'COMPANY', 'DISTRACT'];
const STATUSES: CareActivityStatus[] = ['PLANNED', 'COMPLETED'];
const OUTCOMES: CareOutcome[] = ['better', 'same', 'worse', 'unsure'];

function messageFrom(body: unknown, fallback: string): string {
  const record = (body ?? {}) as Record<string, unknown>;
  const message = record.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseCareActivity(value: unknown): CareActivity | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = asString(record.id);
  const activity = asString(record.activity);
  const status = asString(record.status);
  if (!id || !activity || !ACTIVITIES.includes(activity as CareActivityType)) return null;
  if (!status || !STATUSES.includes(status as CareActivityStatus)) return null;

  const outcome = asString(record.outcome);
  const metadata =
    record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : null;

  return {
    id,
    activity: activity as CareActivityType,
    status: status as CareActivityStatus,
    reflection: asString(record.reflection),
    outcome: outcome && OUTCOMES.includes(outcome as CareOutcome) ? (outcome as CareOutcome) : null,
    metadata,
    completedAt: asString(record.completedAt),
    createdAt: asString(record.createdAt) ?? new Date(0).toISOString(),
    updatedAt: asString(record.updatedAt) ?? new Date(0).toISOString(),
    ...(record.treeDropAwarded === true ? { treeDropAwarded: true } : {}),
  };
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

export function createCareActivity(input: CreateCareActivityInput): Promise<LoadResult<CareActivity>> {
  return request(
    '/care-activities',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'No se pudo guardar la actividad.',
    parseCareActivity,
  );
}

export function updateCareActivity(
  id: string,
  input: UpdateCareActivityInput,
): Promise<LoadResult<CareActivity>> {
  return request(
    `/care-activities/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'No se pudo actualizar la actividad.',
    parseCareActivity,
  );
}

export function listCareActivities(): Promise<LoadResult<{ items: CareActivity[] }>> {
  return request('/care-activities', { method: 'GET' }, 'No se pudieron cargar tus actividades.', (body) => {
    const record = (body ?? {}) as Record<string, unknown>;
    if (!Array.isArray(record.items)) return null;
    return {
      items: record.items
        .map(parseCareActivity)
        .filter((item): item is CareActivity => item !== null),
    };
  });
}
