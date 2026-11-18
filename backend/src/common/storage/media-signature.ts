import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import { keyFromPublicUrl } from './media-keys';

/**
 * URL firmadas para los medios.
 *
 * Los archivos de la biblioteca (imágenes y audios de relatos) solo se sirven
 * con una firma HMAC válida y una caducidad. Así, aunque alguien comparta la
 * URL de un relato privado, el enlace deja de funcionar y no se puede usar para
 * recorrer el almacenamiento. Los avatares públicos quedan fuera porque se
 * muestran en perfiles abiertos.
 */
export function signMediaKey(key: string, ttlMs = env.mediaUrlTtlMs): string {
  const exp = Math.floor((Date.now() + ttlMs) / 1000);
  const sig = createHmac('sha256', env.mediaUrlSecret).update(`${key}:${exp}`).digest('hex');
  return `exp=${exp}&sig=${sig}`;
}

/** Devuelve la URL con firma si pertenece a nuestro almacenamiento. */
export function signedMediaUrl(url: string | null | undefined, ttlMs?: number): string | null {
  if (!url) return null;

  const key = keyFromPublicUrl(url, env.storage.publicBaseUrl);
  if (!key) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${signMediaKey(key, ttlMs)}`;
}

/** Verifica `exp` y `sig` para una clave concreta. */
export function verifyMediaSignature(
  key: string,
  expRaw: unknown,
  sigRaw: unknown,
): boolean {
  const exp = Number(Array.isArray(expRaw) ? expRaw[0] : expRaw);
  const sig = String(Array.isArray(sigRaw) ? sigRaw[0] : sigRaw ?? '');

  if (!Number.isInteger(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = createHmac('sha256', env.mediaUrlSecret)
    .update(`${key}:${exp}`)
    .digest('hex');

  if (sig.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
