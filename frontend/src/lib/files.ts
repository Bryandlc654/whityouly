import { API_URL } from './api';
import { authFetch } from './auth';
import type { LoadResult } from './account';

export interface MediaFile {
  id: string;
  fileUrl: string;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  entityType: string;
  createdAt: string;
}

export interface MediaPage {
  items: MediaFile[];
  nextCursor: string | null;
}

const UPLOAD_TIMEOUT_MS = 30_000;

/** Solo http(s): una URL con `javascript:` no se renderiza nunca. */
function safeUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? value : '';
  } catch {
    return '';
  }
}

function parseFile(payload: Record<string, unknown>): MediaFile | null {
  const id = typeof payload.id === 'string' ? payload.id : null;
  const fileUrl = safeUrl(payload.fileUrl);
  if (!id || !fileUrl) return null;

  return {
    id,
    fileUrl,
    originalName: typeof payload.originalName === 'string' ? payload.originalName : null,
    mimeType: typeof payload.mimeType === 'string' ? payload.mimeType : null,
    sizeBytes: typeof payload.sizeBytes === 'number' ? payload.sizeBytes : null,
    width: typeof payload.width === 'number' ? payload.width : null,
    height: typeof payload.height === 'number' ? payload.height : null,
    entityType: typeof payload.entityType === 'string' ? payload.entityType : 'NONE',
    createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : new Date(0).toISOString(),
  };
}

export async function listFiles(cursor?: string): Promise<LoadResult<MediaPage>> {
  const query = new URLSearchParams({ limit: '24' });
  if (cursor) query.set('cursor', cursor);

  try {
    const response = await authFetch(`${API_URL}/files?${query.toString()}`);

    if (!response.ok) {
      return { status: 'error', message: 'No se pudo cargar tu biblioteca.' };
    }

    const body = await response.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    const parsed = items
      .map((item: unknown) => parseFile((item ?? {}) as Record<string, unknown>))
      .filter((item: MediaFile | null): item is MediaFile => item !== null);

    return {
      status: 'ok',
      data: {
        items: parsed,
        nextCursor: typeof body?.nextCursor === 'string' ? body.nextCursor : null,
      },
    };
  } catch {
    return { status: 'error', message: 'No se pudo cargar tu biblioteca.' };
  }
}

/**
 * La subida no puede pasar por `authFetch` con JSON: es multipart y el tamaño
 * lo corta el servidor. Se reintenta solo el 401 por token caducado.
 */
export async function uploadFile(file: File): Promise<LoadResult<MediaFile>> {
  const form = new FormData();
  form.append('file', file);

  let response: Response;

  try {
    response = await authFetch(`${API_URL}/files`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch {
    return {
      status: 'error',
      message:
        file.size > 30_000_000
          ? 'El archivo es demasiado grande o la subida tardó demasiado.'
          : 'No se pudo subir el archivo.',
    };
  }

  if (!response.ok) {
    let message = 'No se pudo subir el archivo.';
    try {
      const body = await response.json();
      if (Array.isArray(body?.message)) message = body.message.join(' ');
      else if (typeof body?.message === 'string') message = body.message;
    } catch {
      /* respuesta sin cuerpo: nos quedamos con el mensaje genérico */
    }
    return { status: 'error', message };
  }

  const parsed = parseFile(((await response.json()) ?? {}) as Record<string, unknown>);
  return parsed
    ? { status: 'ok', data: parsed }
    : { status: 'error', message: 'La respuesta del servidor no se pudo leer.' };
}

export async function deleteFile(id: string): Promise<LoadResult<{ id: string }>> {
  try {
    const response = await authFetch(`${API_URL}/files/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      let message = 'No se pudo borrar el archivo.';
      try {
        const body = await response.json();
        if (Array.isArray(body?.message)) message = body.message.join(' ');
        else if (typeof body?.message === 'string') message = body.message;
      } catch {
        /* sin cuerpo */
      }
      return { status: 'error', message };
    }

    return { status: 'ok', data: (await response.json()) as { id: string } };
  } catch {
    return { status: 'error', message: 'No se pudo borrar el archivo.' };
  }
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
