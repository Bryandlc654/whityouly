/**
 * Nivel de aviso de un seguimiento de relato.
 *
 * - `ALL` ("Seguir relato"): se avisa de cada etapa nueva.
 * - `CONSERVATIVE` ("Estoy contigo"): se sigue el relato en silencio —aparece en
 *   "Lo que sigo"— pero no genera notificaciones, para no inundar la bandeja.
 *
 * Se guarda como texto en `followers.notifyLevel`. Al seguir un personaje el
 * campo se ignora; solo aplica a `followingStoryId`.
 */
export const STORY_FOLLOW_LEVEL = {
  ALL: 'ALL',
  CONSERVATIVE: 'CONSERVATIVE',
} as const;

export type StoryFollowLevel = (typeof STORY_FOLLOW_LEVEL)[keyof typeof STORY_FOLLOW_LEVEL];
