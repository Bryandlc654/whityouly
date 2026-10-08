const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const MAX_SEGMENT_LENGTH = 96;

/**
 * Una clave válida solo puede contener un prefijo legible (`avatars/...`) y
 * segmentos separados por `/`. El punto se admite (extensiones), pero se
 * bloquean explícitamente `..`, `//`, segmentos `.`/`..` y segmentos que
 * terminen en punto o espacio (normalización de Windows).
 */
export function isSafeMediaKey(key: string): boolean {
  if (typeof key !== 'string' || key.length === 0 || key.length > 255) {
    return false;
  }
  if (key.includes('..') || key.includes('//') || key.startsWith('/')) {
    return false;
  }
  if (!SAFE_KEY.test(key)) {
    return false;
  }
  return key.split('/').every((segment) => {
    if (segment === '' || segment === '.' || segment === '..') {
      return false;
    }
    if (segment.length > MAX_SEGMENT_LENGTH) {
      return false;
    }
    if (segment.endsWith('.') || segment.endsWith(' ')) {
      return false;
    }
    // Nombres reservados de dispositivo en Windows.
    return !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(segment);
  });
}

/** Clave de avatar: se deriva del id del personaje (uuid) y un token aleatorio. */
export function avatarKey(characterId: string, randomToken: string): string {
  return `avatars/${characterId}/${randomToken}.webp`;
}

/**
 * Clave de un archivo de la biblioteca personal. El id de usuario va en la ruta
 * para que un bucket compartido siga siendo ordenable y para que las políticas
 * del bucket puedan razonar sobre quién es el dueño.
 */
export function mediaKey(userId: string, randomToken: string): string {
  return `media/${userId}/${randomToken}.webp`;
}

/**
 * Extensiones aceptadas para audio, por MIME. Se usa tanto para decidir la
 * extensión del objeto guardado como para validar el tipo declarado. La lista
 * es blanca: cualquier otro MIME se rechaza.
 */
export const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

export function audioExtensionForMime(mime: string | undefined): string | null {
  if (!mime) return null;
  return AUDIO_EXTENSION_BY_MIME[mime.toLowerCase()] ?? null;
}

/** Clave de un audio de la biblioteca personal. */
export function audioKey(userId: string, randomToken: string, extension: string): string {
  return `media/${userId}/${randomToken}.${extension}`;
}

/**
 * Extrae la clave de almacenamiento de una URL pública propia.
 * Devuelve `null` si la URL no pertenece a nuestro espacio de nombres, lo que
 * impide borrar o exponer objetos ajenos.
 */
export function keyFromPublicUrl(url: string, publicBaseUrl: string): string | null {
  if (typeof url !== 'string' || !url.startsWith(`${publicBaseUrl}/`)) {
    return null;
  }
  const key = url.slice(publicBaseUrl.length + 1);
  return isSafeMediaKey(key) ? key : null;
}

/** `true` si la URL apunta a un objeto de nuestro propio almacenamiento. */
export function isOwnMediaUrl(url: string, publicBaseUrl: string): boolean {
  return keyFromPublicUrl(url, publicBaseUrl) !== null;
}
