'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import type { IconName } from './icons';
import Avatar from './Avatar';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/lib/notifications';

interface NotificationsPanelProps {
  onClose: () => void;
  onOpenStory: (storyId: string) => void;
  onOpenCharacter: (name: string) => void;
}

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function relativeTime(value: string): string {
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

const storyTitle = (item: NotificationItem) => `«${item.story?.title ?? 'un relato'}»`;

function describe(item: NotificationItem): { icon: IconName; text: string } {
  const who = item.actor?.name ?? 'Alguien';
  const story = storyTitle(item);

  switch (item.type) {
    case 'FOLLOW':
      return { icon: 'users', text: `${who} empezó a seguirte` };
    case 'COMMENT':
      return { icon: 'message', text: `${who} comentó en tu relato ${story}` };
    case 'COMMENT_REPLY':
      return { icon: 'message', text: `${who} respondió a un comentario en ${story}` };
    case 'COMPANIONSHIP':
      return {
        icon: 'heart',
        text: item.entityType === 'STORY'
          ? `${who} te acompañó en ${story}`
          : `${who} te acompañó`,
      };
    case 'STORY_UPDATE':
      return { icon: 'book', text: `El relato que sigues ${story} tiene una etapa nueva` };
    case 'MODERATION':
      return { icon: 'shield', text: 'El equipo de moderación revisó tu contenido' };
    case 'SYSTEM':
      return { icon: 'bell', text: 'Aviso de la plataforma' };
    default:
      return { icon: 'bell', text: 'Tienes una notificación nueva' };
  }
}

export default function NotificationsPanel({ onClose, onOpenStory, onOpenCharacter }: NotificationsPanelProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await listNotifications({ limit: 50 });
    setLoading(false);

    if (result.status === 'ok') {
      setItems(result.data.items);
    } else {
      setError(result.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (item: NotificationItem) => {
    if (item.status === 'UNREAD') {
      void markNotificationRead(item.id);
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, status: 'READ' as const } : row)),
      );
    }

    if (item.entityType === 'STORY' && item.entityId) {
      onOpenStory(item.entityId);
    } else if (item.actor && item.entityType === 'CHARACTER') {
      onOpenCharacter(item.actor.name);
    }
  };

  const markAllRead = async () => {
    const result = await markAllNotificationsRead();
    if (result.status === 'ok') {
      setItems((prev) => prev.map((row) => ({ ...row, status: 'READ' as const })));
    }
  };

  const unreadCount = items.reduce((acc, item) => acc + (item.status === 'UNREAD' ? 1 : 0), 0);

  return (
    <div className="modal notifications-modal" role="dialog" aria-modal="true" aria-label="Notificaciones">
      <div className="modal-head">
        <div>
          <h2>Notificaciones</h2>
          {unreadCount > 0 ? <p className="muted small">{unreadCount} sin leer</p> : null}
        </div>
        <button className="close" type="button" onClick={onClose} aria-label="Cerrar">
          <Icon name="x" />
        </button>
      </div>

      {unreadCount > 0 ? (
        <div style={{ marginTop: 10 }}>
          <button className="text-link" type="button" onClick={() => void markAllRead()}>
            Marcar todas como leídas
          </button>
        </div>
      ) : null}

      {loading ? <p className="muted small" style={{ marginTop: 16 }}>Cargando…</p> : null}

      {error ? (
        <div className="auth-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="empty card" style={{ marginTop: 16 }}>
          <div className="empty-icon">
            <Icon name="bell" />
          </div>
          <h2>Todo al día</h2>
          <p>Te avisaremos aquí cuando alguien te siga, comente o te acompañe.</p>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <ul className="notification-list" style={{ marginTop: 12 }}>
          {items.map((item) => {
            const { icon, text } = describe(item);
            const unread = item.status === 'UNREAD';
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`notification-item ${unread ? 'unread' : ''}`}
                  onClick={() => void open(item)}
                >
                  <span className="notification-icon">
                    <Icon name={icon} />
                  </span>
                  <Avatar initials={initialsOf(item.actor?.name)} avatarUrl={item.actor?.avatarUrl} size="sm" />
                  <span className="notification-body">
                    <span className="notification-text">{text}</span>
                    <small className="hint">{relativeTime(item.createdAt)}</small>
                  </span>
                  {unread ? <span className="notification-dot" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}