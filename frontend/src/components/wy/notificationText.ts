import type { IconName } from './icons';
import type { NotificationItem } from '@/lib/notifications';

export function notificationInitials(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

export function notificationTime(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const diff = Date.now() - time;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `Hace ${days} d`;
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(time));
}

export function describeNotification(item: NotificationItem): { icon: IconName; text: string } {
  const who = item.actor?.name ?? 'Alguien';
  const story = `“${item.story?.title ?? 'un relato'}”`;
  const extra =
    item.count > 1
      ? ` y ${item.count - 1} ${item.count - 1 === 1 ? 'persona más' : 'personas más'}`
      : '';
  const commented = item.count > 1 ? 'comentaron' : 'comentó';
  const supported = item.count > 1 ? 'acompañaron' : 'acompañó';

  switch (item.type) {
    case 'FOLLOW':
      return { icon: 'users', text: `${who} empezó a seguirte` };
    case 'COMMENT':
      return { icon: 'message', text: `${who}${extra} ${commented} en tu relato ${story}` };
    case 'COMMENT_REPLY':
      return { icon: 'message', text: `${who} respondió a tu comentario en ${story}` };
    case 'COMPANIONSHIP':
      return {
        icon: 'heart',
        text:
          item.entityType === 'STORY'
            ? `${who}${extra} te ${supported} en ${story}`
            : `${who}${extra} te ${supported}`,
      };
    case 'STORY_UPDATE':
      return { icon: 'book', text: `${who} añadió una etapa a ${story}` };
    case 'MODERATION':
      return { icon: 'shield', text: 'El equipo de moderación revisó tu contenido' };
    case 'SYSTEM':
      return { icon: 'bell', text: 'Aviso de la plataforma' };
    default:
      return { icon: 'bell', text: 'Tienes una notificación nueva' };
  }
}

export const IMPORTANT_NOTIFICATION_TYPES = new Set([
  'COMMENT',
  'COMMENT_REPLY',
  'STORY_UPDATE',
  'MODERATION',
]);
