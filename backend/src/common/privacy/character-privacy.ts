/**
 * Criterio único para interpretar los ajustes de privacidad del personaje.
 *
 * Vive fuera de `characters.service` para que relatos, comentarios,
 * notificaciones y descubrimiento apliquen exactamente la misma regla sin
 * importar el servicio completo (y sin crear dependencias circulares).
 */
export interface ResolvedPrivacy {
  profileVisibility: 'PUBLIC' | 'PRIVATE';
  showAvatar: boolean;
  showBio: boolean;
  showFollowing: boolean;
}

export const DEFAULT_PRIVACY: ResolvedPrivacy = {
  profileVisibility: 'PUBLIC',
  showAvatar: true,
  showBio: true,
  // Por defecto la lista de "a quién sigo" es privada; solo se comparte si la
  // persona lo activa. Los seguidores sí son públicos en perfiles públicos.
  showFollowing: false,
};

export function resolvePrivacySettings(settings: unknown): ResolvedPrivacy {
  const source = (settings ?? {}) as Record<string, unknown>;

  return {
    profileVisibility: source.profileVisibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
    showAvatar: typeof source.showAvatar === 'boolean' ? source.showAvatar : DEFAULT_PRIVACY.showAvatar,
    showBio: typeof source.showBio === 'boolean' ? source.showBio : DEFAULT_PRIVACY.showBio,
    showFollowing:
      typeof source.showFollowing === 'boolean' ? source.showFollowing : DEFAULT_PRIVACY.showFollowing,
  };
}

/** Avatar visible para terceros: `null` si la persona decidió ocultarlo. */
export function visibleAvatar(
  character:
    | { avatarUrl: string | null; privacySettings?: unknown }
    | null
    | undefined,
): string | null {
  if (!character) return null;
  return resolvePrivacySettings(character.privacySettings).showAvatar
    ? character.avatarUrl
    : null;
}
