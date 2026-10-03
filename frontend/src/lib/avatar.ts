/**
 * Límites del avatar. Deben coincidir con `AVATAR_MAX_BYTES` del backend
 * (`backend/.env.example`); el servidor vuelve a validarlos siempre.
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const AVATAR_ACCEPT = AVATAR_ACCEPTED_TYPES.join(',');

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
