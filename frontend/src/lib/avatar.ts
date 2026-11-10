import { isAvatarCustomUrl } from './avatar-creator';

/**
 * Límites del avatar. Deben coincidir con `AVATAR_MAX_BYTES` del backend
 * (`backend/.env.example`); el servidor vuelve a validarlos siempre.
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const AVATAR_ACCEPT = AVATAR_ACCEPTED_TYPES.join(',');

/** Catálogo cerrado de avatares ilustrados incluidos en `/public/avatars`. */
export const AVATAR_PRESETS = Array.from({ length: 12 }, (_, index) =>
  `/avatars/${String(index + 25).padStart(2, '0')}.svg`,
);

/** Avatares de animales ilustrados (`/public/avatars/animal-NN.svg`). */
export const ANIMAL_AVATARS = [
  'Gato', 'Perro', 'Zorro', 'Oso', 'Conejo', 'Panda',
  'Búho', 'Koala', 'León', 'Pingüino', 'Mapache', 'Rana',
].map((label, index) => ({ url: `/avatars/animal-${String(index + 1).padStart(2, '0')}.svg`, label }));

const AVATAR_PRESET_PATTERN = /^\/avatars\/(?:2[5-9]|3[0-6]|animal-(?:0[1-9]|1[0-2]))\.svg$/;

export function isAvatarPresetUrl(value: unknown): value is string {
  return typeof value === 'string' && AVATAR_PRESET_PATTERN.test(value);
}

export function isAvatarCatalogUrl(value: unknown): value is string {
  return isAvatarPresetUrl(value) || isAvatarCustomUrl(value);
}

/**
 * URL de avatar segura: solo nuestros avatares ilustrados o una URL http(s).
 * Nunca se aceptan `javascript:`, `data:` ni rutas arbitrarias.
 */
export function safeAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  if (isAvatarCatalogUrl(value)) return value;

  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_ACCEPTED_TYPES.includes(file.type as (typeof AVATAR_ACCEPTED_TYPES)[number])) {
    return 'Formato no válido. Usa una imagen JPEG, PNG o WebP.';
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return `La imagen supera el máximo de ${Math.floor(AVATAR_MAX_BYTES / 1024 / 1024)} MB.`;
  }

  if (file.size === 0) {
    return 'El archivo está vacío.';
  }

  return null;
}
