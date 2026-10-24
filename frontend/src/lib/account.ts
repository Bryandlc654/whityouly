import { API_URL } from './api';
import { authFetch } from './auth';

export type ReadingSize = 'NORMAL' | 'LARGE' | 'LARGER';

export interface AccountPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  notificationsEnabled: boolean;
  readingSize: ReadingSize;
  theme: string;
  language: string;
}

export interface AccountDeletion {
  id: string;
  requestedAt: string;
  eligibleAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
}

export interface Account {
  id: string;
  email: string;
  isEmailVerified: boolean;
  role: string;
  status: string;
  createdAt: string;
  preferences: AccountPreferences;
  usage: { characters: number; media: number };
  activeSessions: number;
  deletion: AccountDeletion | null;
}

function parseDeletion(value: unknown): AccountDeletion | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const requestedAt = typeof record.requestedAt === 'string' ? record.requestedAt : null;
  const eligibleAt = typeof record.eligibleAt === 'string' ? record.eligibleAt : null;
  if (!id || !requestedAt || !eligibleAt) return null;

  return {
    id,
    requestedAt,
    eligibleAt,
    cancelledAt: typeof record.cancelledAt === 'string' ? record.cancelledAt : null,
    completedAt: typeof record.completedAt === 'string' ? record.completedAt : null,
  };
}

export type LoadResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; message: string };

const DEFAULT_PREFERENCES: AccountPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  notificationsEnabled: true,
  readingSize: 'NORMAL',
  theme: 'light',
  language: 'es',
};

/**
 * Los errores de la API son texto para personas, no para máquinas: se muestra
 * tal cual. Si la respuesta no es JSON (un 502 de un proxy, por ejemplo) se
 * devuelve un mensaje genérico en lugar de romper la pantalla.
 */
async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    const message = body?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string' && message.trim() !== '') return message;
    return typeof body?.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}

async function request<T>(path: string, init: RequestInit, fallback: string): Promise<LoadResult<T>> {
  let response: Response;

  try {
    response = await authFetch(`${API_URL}${path}`, init);
  } catch {
    return { status: 'error', message: 'No se pudo contactar con el servidor.' };
  }

  if (!response.ok) {
    return { status: 'error', message: await readError(response, fallback) };
  }

  try {
    return { status: 'ok', data: (await response.json()) as T };
  } catch {
    return { status: 'error', message: fallback };
  }
}

async function requestParsed<T>(
  path: string,
  init: RequestInit,
  fallback: string,
  parse: (body: unknown) => T | null,
): Promise<LoadResult<T>> {
  let response: Response;

  try {
    response = await authFetch(`${API_URL}${path}`, init);
  } catch {
    return { status: 'error', message: 'No se pudo contactar con el servidor.' };
  }

  if (!response.ok) {
    return { status: 'error', message: await readError(response, fallback) };
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

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function fetchAccount(): Promise<LoadResult<Account>> {
  const result = await request<Account>('/users/me', { method: 'GET' }, 'No se pudo cargar tu cuenta.');

  if (result.status !== 'ok') {
    return result;
  }

  const data = result.data;

  // Si el backend responde con algo inesperado, se usan valores seguros en lugar
  // de romper la vista de configuración.
  return {
    status: 'ok',
    data: {
      id: typeof data?.id === 'string' ? data.id : '',
      email: typeof data?.email === 'string' ? data.email : '',
      isEmailVerified: data?.isEmailVerified === true,
      role: typeof data?.role === 'string' ? data.role : 'USER',
      status: typeof data?.status === 'string' ? data.status : 'ACTIVE',
      createdAt: typeof data?.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
      preferences: { ...DEFAULT_PREFERENCES, ...(data?.preferences ?? {}) },
      usage: {
        characters: Number(data?.usage?.characters ?? 0),
        media: Number(data?.usage?.media ?? 0),
      },
      activeSessions: Number(data?.activeSessions ?? 0),
      deletion: parseDeletion(data?.deletion),
    },
  };
}

export async function savePreferences(
  preferences: Partial<AccountPreferences>,
): Promise<LoadResult<AccountPreferences>> {
  return request<AccountPreferences>(
    '/users/me/preferences',
    { ...json(preferences), method: 'PATCH' },
    'No se pudieron guardar las preferencias.',
  );
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<LoadResult<{ message: string }>> {
  return request<{ message: string }>(
    '/users/me/password',
    json(input),
    'No se pudo cambiar la contraseña.',
  );
}

export async function requestEmailChange(input: {
  newEmail: string;
  currentPassword: string;
}): Promise<LoadResult<{ message: string }>> {
  return request<{ message: string }>(
    '/users/me/email',
    json(input),
    'No se pudo pedir el cambio de correo.',
  );
}

export async function requestAccountDeletion(input: {
  currentPassword: string;
  confirmation: string;
}): Promise<LoadResult<{ message: string; deletion: AccountDeletion; revokedSessions: number }>> {
  return requestParsed(
    '/users/me/deletion',
    json(input),
    'No se pudo solicitar la baja de la cuenta.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const deletion = parseDeletion(record.deletion);
      if (!deletion) return null;
      return {
        message: typeof record.message === 'string' ? record.message : 'Solicitud registrada.',
        deletion,
        revokedSessions:
          typeof record.revokedSessions === 'number' ? record.revokedSessions : 0,
      };
    },
  );
}

export async function cancelAccountDeletion(): Promise<
  LoadResult<{ message: string; deletion: AccountDeletion }>
> {
  return requestParsed(
    '/users/me/deletion/cancel',
    { method: 'POST' },
    'No se pudo cancelar la baja.',
    (body) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const deletion = parseDeletion(record.deletion);
      if (!deletion) return null;
      return {
        message:
          typeof record.message === 'string'
            ? record.message
            : 'Solicitud cancelada.',
        deletion,
      };
    },
  );
}

/**
 * Descarga el JSON completo de la cuenta. Se hace por `authFetch` para que el
 * token viaje en la cabecera y no en la URL (no queda en historiales ni logs).
 */
export async function exportAccountData(): Promise<
  LoadResult<{ blob: Blob; filename: string }>
> {
  let response: Response;

  try {
    response = await authFetch(`${API_URL}/users/me/export`, {
      method: 'GET',
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return { status: 'error', message: 'No se pudo contactar con el servidor.' };
  }

  if (!response.ok) {
    return {
      status: 'error',
      message: await readError(response, 'No se pudieron exportar tus datos.'),
    };
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] ?? 'withyouly-mis-datos.json';

  return { status: 'ok', data: { blob: await response.blob(), filename } };
}

/**
 * La confirmación va sin `authFetch`: quien llega desde el enlace del correo
 * puede no tener sesión, y el token firmado es la autorización.
 */
export async function confirmEmailChange(token: string): Promise<LoadResult<{ message: string }>> {
  try {
    const response = await fetch(`${API_URL}/users/me/email/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return { status: 'error', message: await readError(response, 'El enlace no es válido o ha expirado.') };
    }

    return { status: 'ok', data: (await response.json()) as { message: string } };
  } catch {
    return { status: 'error', message: 'No se pudo contactar con el servidor.' };
  }
}
