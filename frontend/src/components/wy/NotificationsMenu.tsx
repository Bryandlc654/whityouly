'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationsCount,
  type NotificationItem,
} from '@/lib/notifications';
import { describeNotification, notificationTime } from './notificationText';

interface NotificationsMenuProps {
  unreadCount: number;
}

const PREVIEW_LIMIT = 6;

export default function NotificationsMenu({ unreadCount }: NotificationsMenuProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState('');
  const [localUnread, setLocalUnread] = useState<number | null>(null);

  const badge = localUnread ?? unreadCount;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await listNotifications({ limit: PREVIEW_LIMIT });
    setLoading(false);
    if (result.status === 'ok') {
      setItems(result.data.items);
      setLocalUnread(result.data.unreadCount);
    } else {
      setError(result.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void unreadNotificationsCount().then((result) => {
      if (active && result.status === 'ok') setLocalUnread(result.data.count);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openItem = async (item: NotificationItem) => {
    if (item.status === 'UNREAD') {
      void markNotificationRead(item.id);
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, status: 'READ' as const } : row)),
      );
      setLocalUnread((current) => Math.max(0, (current ?? badge) - 1));
    }

    setOpen(false);
    if (item.entityType === 'STORY' && item.entityId) {
      router.push(`/relato/${encodeURIComponent(item.entityId)}`);
    } else if (item.actor && item.entityType === 'CHARACTER') {
      router.push(`/personaje/${encodeURIComponent(item.actor.name)}`);
    }
  };

  const markAllRead = async () => {
    const result = await markAllNotificationsRead();
    if (result.status !== 'ok') return;
    setItems((prev) => prev.map((row) => ({ ...row, status: 'READ' as const })));
    setLocalUnread(0);
  };

  return (
    <div className="notif-menu" ref={containerRef}>
      <button
        className="icon-btn"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notificaciones"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon name="bell" />
        {badge > 0 ? (
          <span className="notif-badge" aria-hidden>
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notif-dropdown" role="dialog" aria-label="Notificaciones">
          <div className="notif-dropdown-head">
            <div>
              <h3>Notificaciones</h3>
              {badge > 0 ? <small>{badge} sin leer</small> : <small>Todo al día</small>}
            </div>
            {badge > 0 ? (
              <button className="text-link" type="button" onClick={() => void markAllRead()}>
                Marcar leídas
              </button>
            ) : null}
          </div>

          <div className="notif-dropdown-list">
            {loading ? <p className="notif-dropdown-status">Cargando…</p> : null}
            {!loading && error ? <p className="notif-dropdown-status">{error}</p> : null}
            {!loading && !error && items.length === 0 ? (
              <p className="notif-dropdown-status">
                Te avisaremos cuando alguien te siga, comente o te acompañe.
              </p>
            ) : null}
            {!loading && !error
              ? items.map((item) => {
                  const { icon, text } = describeNotification(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`notif-row${item.status === 'UNREAD' ? ' unread' : ''}`}
                      onClick={() => void openItem(item)}
                    >
                      <span className="notif-row-icon">
                        <Icon name={icon} />
                      </span>
                      <span className="notif-row-copy">
                        <b>{text}</b>
                        <small>{notificationTime(item.createdAt)}</small>
                      </span>
                      {item.status === 'UNREAD' ? <span className="notif-row-dot" aria-hidden /> : null}
                    </button>
                  );
                })
              : null}
          </div>

          <div className="notif-dropdown-foot">
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setOpen(false);
                router.push('/notificaciones');
              }}
            >
              Ver más
              <Icon name="chevron" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
