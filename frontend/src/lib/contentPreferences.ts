import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

export type AuthorPreferenceKind = 'MUTE' | 'BLOCK' | 'LESS';

export interface AuthorPreference {
  id: string;
  authorName: string;
  kind: AuthorPreferenceKind;
  createdAt: string;
}

function messageFrom(body: unknown, fallback: string): string {
  const record = (body ?? {}) as Record<string, unknown>;
  const message = record.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

export async function listAuthorPreferences(): Promise<LoadResult<AuthorPreference[]>> {
  try {
    const response = await authFetch(`${API_URL}/content-preferences`);
    if (!response.ok) return { status: 'error', message: 'No se pudieron cargar tus preferencias.' };
    const body = await response.json();
    return {
      status: 'ok',
      data: Array.isArray(body)
        ? body
            .map((item: unknown) => {
              const row = (item ?? {}) as Record<string, unknown>;
              const id = typeof row.id === 'string' ? row.id : null;
              const authorName = typeof row.authorName === 'string' ? row.authorName : null;
              const kind =
                row.kind === 'MUTE' || row.kind === 'BLOCK' || row.kind === 'LESS'
                  ? row.kind
                  : null;
              if (!id || !authorName || !kind) return null;
              return {
                id,
                authorName,
                kind,
                createdAt:
                  typeof row.createdAt === 'string'
                    ? row.createdAt
                    : new Date(0).toISOString(),
              } satisfies AuthorPreference;
            })
            .filter((item): item is AuthorPreference => item !== null)
        : [],
    };
  } catch {
    return { status: 'error', message: 'No se pudieron cargar tus preferencias.' };
  }
}

export async function saveAuthorPreference(
  authorName: string,
  kind: AuthorPreferenceKind,
): Promise<LoadResult<AuthorPreference>> {
  try {
    const response = await authFetch(`${API_URL}/content-preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorName, kind }),
    });
    if (!response.ok) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        /* sin cuerpo */
      }
      return { status: 'error', message: messageFrom(body, 'No se pudo guardar la preferencia.') };
    }
    const body = (await response.json()) as AuthorPreference;
    return { status: 'ok', data: body };
  } catch {
    return { status: 'error', message: 'No se pudo guardar la preferencia.' };
  }
}

export async function removeAuthorPreference(id: string): Promise<LoadResult<{ id: string }>> {
  try {
    const response = await authFetch(`${API_URL}/content-preferences/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return response.ok
      ? { status: 'ok', data: { id } }
      : { status: 'error', message: 'No se pudo quitar la preferencia.' };
  } catch {
    return { status: 'error', message: 'No se pudo quitar la preferencia.' };
  }
}
