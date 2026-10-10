/**
 * Códigos de evento que puede emitir la plataforma. Se guardan como texto en
 * `notifications.type` (no hay enum en la base) para poder añadir tipos nuevos
 * sin migración, pero se centralizan aquí para que emisor y lector no se
 * desincronicen escribiendo cadenas a mano.
 */
export const NOTIFICATION_TYPES = {
  FOLLOW: 'FOLLOW',
  COMMENT: 'COMMENT',
  COMMENT_REPLY: 'COMMENT_REPLY',
  COMPANIONSHIP: 'COMPANIONSHIP',
  STORY_UPDATE: 'STORY_UPDATE',
  MODERATION: 'MODERATION',
  SYSTEM: 'SYSTEM',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/**
 * Entidad sobre la que actúa la notificación. `SYSTEM` cubre los avisos sin
 * objeto (mensajes de la plataforma).
 */
export const NOTIFICATION_ENTITY = {
  STORY: 'STORY',
  CHARACTER: 'CHARACTER',
  SYSTEM: 'SYSTEM',
} as const;

export type NotificationEntityType =
  (typeof NOTIFICATION_ENTITY)[keyof typeof NOTIFICATION_ENTITY];
