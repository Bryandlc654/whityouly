import { API_URL } from './api';
import { authFetch } from './auth';

export interface AccountPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  theme: string;
  language: string;
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
}

export type LoadResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; message: string };

const DEFAULT_PREFERENCES: AccountPreferences = {
  emailNotifications: true,
  pushNotifications: true,
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

export async function deleteAccount(input: {
  currentPassword: string;
  confirmation: string;
}): Promise<LoadResult<{ message: string }>> {
  return request<{ message: string }>(
    '/users/me',
    { ...json(input), method: 'DELETE' },
    'No se pudo dar de baja la cuenta.',
  );
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
