/**
 * Catálogo cerrado de avatares ilustrados. Vive en el frontend como SVG
 * estático o generado por `/avatars/custom`; el backend solo acepta estas
 * rutas para que un cliente no pueda inyectar una URL arbitraria en
 * `avatarUrl`.
 */
export const AVATAR_PRESET_COUNT = 12;
/** Avatares de animales: `/avatars/animal-01.svg` … `/avatars/animal-12.svg`. */
export const AVATAR_ANIMAL_COUNT = 12;
export const AVATAR_PRESET_PATTERN = /^\/avatars\/(?:2[5-9]|3[0-6]|animal-(?:0[1-9]|1[0-2]))\.svg$/;
export const AVATAR_CUSTOM_PATTERN = /^\/avatars\/custom\?[A-Za-z0-9_=&-]{1,700}$/;
export const AVATAR_REFERENCE_PATTERN =
  /^(https:\/\/\S+|\/avatars\/(?:(?:2[5-9]|3[0-6]|animal-(?:0[1-9]|1[0-2]))\.svg|custom\?[A-Za-z0-9_=&-]{1,700}))$/;

export function isAvatarPresetUrl(value: unknown): value is string {
  return typeof value === 'string' && AVATAR_PRESET_PATTERN.test(value);
}

export function isAvatarCustomUrl(value: unknown): value is string {
  return typeof value === 'string' && AVATAR_CUSTOM_PATTERN.test(value);
}

export function isAvatarCatalogUrl(value: unknown): value is string {
  return isAvatarPresetUrl(value) || isAvatarCustomUrl(value);
}
