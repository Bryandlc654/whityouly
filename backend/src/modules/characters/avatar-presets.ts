/**
 * Catálogo cerrado de avatares ilustrados. Vive en el frontend como SVG
 * estático; el backend solo acepta exactamente estas rutas para que un cliente
 * no pueda inyectar una URL arbitraria en `avatarUrl`.
 */
export const AVATAR_PRESET_COUNT = 36;
export const AVATAR_PRESET_PATTERN = /^\/avatars\/(?:0[1-9]|[12][0-9]|3[0-6])\.svg$/;
export const AVATAR_REFERENCE_PATTERN = /^(https:\/\/\S+|\/avatars\/(?:0[1-9]|[12][0-9]|3[0-6])\.svg)$/;

export function isAvatarPresetUrl(value: unknown): value is string {
  return typeof value === 'string' && AVATAR_PRESET_PATTERN.test(value);
}
