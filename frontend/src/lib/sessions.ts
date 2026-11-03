import { API_URL } from './api';
import { authFetch } from './auth';

export interface AuthSession {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

type Result<T> = { status: 'ok'; data: T } | { status: 'error'; message: string };

const REQUEST_TIMEOUT_MS = 15_000;

function messageFrom(body: unknown, fallback: string): string {
  const record = (body ?? {}) as Record<string, unknown>;
  const message = record.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

function parseSession(value: unknown): AuthSession | null {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' && record.id ? record.id : null;
  if (!id) return null;

  return {
    id,
    deviceInfo: typeof record.deviceInfo === 'string' ? record.deviceInfo : null,
    ipAddress: typeof record.ipAddress === 'string' ? record.ipAddress : null,
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
    expiresAt:
      typeof record.expiresAt === 'string' ? record.expiresAt : new Date(0).toISOString(),
    current: record.current === true,
  };
}

export async function listSessions(): Promise<Result<AuthSession[]>> {
  let response: Response;

  try {
    response = await authFetch(`${API_URL}/auth/sessions`, {
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
    return { status: 'error', message: messageFrom(body, 'No se pudieron cargar tus sesiones.') };
  }

  try {
    const body = (await response.json()) as unknown;
    const items = Array.isArray(body)
      ? body.map(parseSession).filter((item): item is AuthSession => item !== null)
      : [];
    return { status: 'ok', data: items };
  } catch {
    return { status: 'error', message: 'No se pudieron cargar tus sesiones.' };
  }
}

export async function revokeSession(id: string): Promise<Result<null>> {
  let response: Response;

  try {
    response = await authFetch(`${API_URL}/auth/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
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
    return { status: 'error', message: messageFrom(body, 'No se pudo cerrar la sesión.') };
  }

  return { status: 'ok', data: null };
}

export async function revokeOtherSessions(): Promise<Result<{ revokedCount: number }>> {
  let response: Response;

  try {
    response = await authFetch(`${API_URL}/auth/sessions/revoke-others`, {
      method: 'POST',
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
    return { status: 'error', message: messageFrom(body, 'No se pudieron cerrar las sesiones.') };
  }

  try {
    const body = (await response.json()) as Record<string, unknown>;
    return {
      status: 'ok',
      data: {
        revokedCount: typeof body.revokedCount === 'number' ? body.revokedCount : 0,
      },
    };
  } catch {
    return { status: 'ok', data: { revokedCount: 0 } };
  }
}
