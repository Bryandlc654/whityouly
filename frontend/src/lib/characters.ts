import { API_URL } from './api';

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_NAME_LENGTH = 30;
const MAX_BIO_LENGTH = 500;
const MAX_TAGLINE_LENGTH = 120;
const MAX_INTERESTS = 8;
const MAX_INTEREST_LENGTH = 40;

export interface PublicProfile {
  name: string;
  tagline: string | null;
  avatarUrl: string | null;
  bio: string | null;
  interests: string[];
  createdAt: string | null;
}

/**
 * Se distingue entre "no hay perfil" y "no se pudo saber". Un perfil privado y
 * uno inexistente devuelven el mismo 404, así que `missing` no revela si el
 * seudónimo está registrado. Un 429 o un 500 no son un 404 y no se deben
 * disfrazar como tal.
 */
export type PublicProfileResult =
  | { status: 'found'; profile: PublicProfile }
  | { status: 'missing' }
  | { status: 'unavailable' };

export async function fetchPublicProfile(name: string): Promise<PublicProfileResult> {
  const normalized = name.normalize('NFKC').replace(/\s+/g, ' ').trim();

  if (!normalized || normalized.length > MAX_NAME_LENGTH) {
    return { status: 'missing' };
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}/characters/${encodeURIComponent(normalized)}`, {
      // Sin caché: al cambiar la privacidad o la biografía el perfil tiene que
      // desaparecer o actualizarse de inmediato, sin esperar a revalidar.
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { status: 'unavailable' };
  }

  if (response.status === 404) {
    return { status: 'missing' };
  }

  if (!response.ok) {
    return { status: 'unavailable' };
  }

  const profile = parseProfile(await response.json().catch(() => null));

  // Un cuerpo que no encaja con el contrato es un problema de la API, no la
  // prueba de que el perfil no exista.
  return profile ? { status: 'found', profile } : { status: 'unavailable' };
}

/**
 * La respuesta de la API no se toma como cierta: si un despliegue futuro
 * devolviera un cuerpo inesperado, la página no debe romperse ni renderizar
 * tipos inesperados.
 */
function parseProfile(payload: unknown): PublicProfile | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const { name, tagline, avatarUrl, bio, interests, createdAt } = payload as Record<string, unknown>;

  if (typeof name !== 'string' || name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return null;
  }

  return {
    name,
    tagline: isBoundedString(tagline, MAX_TAGLINE_LENGTH),
    avatarUrl: isSafeImageUrl(avatarUrl),
    bio: isBoundedString(bio, MAX_BIO_LENGTH),
    interests: parseInterests(interests),
    createdAt: typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt)) ? createdAt : null,
  };
}

function isBoundedString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.slice(0, max) : null;
}

/**
 * Los intereses llegan del catálogo curado por el servidor, pero el perfil se
 * dibuja con lo que se reciba: se limita el número y la longitud de cada uno y
 * se descartan duplicados, igual que hace la API al guardar.
 */
function parseInterests(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.slice(0, MAX_INTEREST_LENGTH))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, MAX_INTERESTS);
}

/**
 * Solo http(s). Cualquier otro esquema (por ejemplo `javascript:` o `data:`)
 * queda descartado aunque la base llegara a contenerlo.
 */
function isSafeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') {
    return null;
  }

  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

export function formatJoinDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
