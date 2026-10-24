/**
 * Catálogo cerrado de avatares ilustrados. Vive en el frontend como SVG
 * estático; el backend solo acepta exactamente estas rutas para que un cliente
 * no pueda inyectar una URL arbitraria en `avatarUrl`.
 */
export const AVATAR_PRESET_COUNT = 24;
export const AVATAR_PRESET_PATTERN = /^\/avatars\/(?:0[1-9]|1[0-9]|2[0-4])\.svg$/;
export const AVATAR_REFERENCE_PATTERN = /^(https:\/\/\S+|\/avatars\/(?:0[1-9]|1[0-9]|2[0-4])\.svg)$/;

export function isAvatarPresetUrl(value: unknown): value is string {
  return typeof value === 'string' && AVATAR_PRESET_PATTERN.test(value);
}
