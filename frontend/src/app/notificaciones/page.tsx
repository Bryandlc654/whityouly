'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Icon from '@/components/wy/Icon';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/lib/notifications';
import {
  describeNotification,
  IMPORTANT_NOTIFICATION_TYPES,
  notificationTime,
} from '@/components/wy/notificationText';

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

export default function NotificationsPage() {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const loadNotifications = useCallback(async () => {
    setListLoading(true);
    setError('');
    const result = await listNotifications({ limit: 50 });
    setListLoading(false);

    if (result.status === 'ok') {
      setItems(result.data.items);
      setUnread(result.data.unreadCount);
      return;
    }

    setError(result.message);
  }, []);

  useEffect(() => {
    const verify = async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/login');
        return;
      }

      try {
        const res = await authFetch(`${API_URL}/characters/me`);
        if (res.status === 401) {
          tokenStorage.clear();
          router.replace('/login');
          return;
        }
        if (res.status === 404) {
          router.replace('/onboarding');
          return;
        }
        if (res.ok) setCharacter(await res.json());
      } catch (err) {
        console.error('Error verificando sesión', err);
      } finally {
        setLoading(false);
      }
    };

    void verify();
  }, [router]);

  useEffect(() => {
    if (!loading) void loadNotifications();
  }, [loading, loadNotifications]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Ir al Feed', icon: 'home', onClick: () => router.push('/feed') },
        { label: 'Mis relatos', icon: 'book', onClick: () => router.push('/mis-relatos') },
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
        { label: 'Ayuda y soporte', icon: 'mail', onClick: () => router.push('/soporte') },
        { label: 'Configuración de la cuenta', icon: 'settings', onClick: () => router.push('/cuenta/configuracion') },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        router.push('/feed');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'mood':
        router.push('/mi-estado');
        break;
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'help':
        router.push('/soporte');
        break;
      case 'notifications':
        void loadNotifications();
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const openItem = async (item: NotificationItem) => {
    if (item.status === 'UNREAD') {
      void markNotificationRead(item.id);
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, status: 'READ' as const } : row)),
      );
      setUnread((current) => Math.max(0, current - 1));
    }

    if (item.entityType === 'STORY' && item.entityId) {
      router.push(`/relato/${encodeURIComponent(item.entityId)}`);
    } else if (item.actor && item.entityType === 'CHARACTER') {
      router.push(`/personaje/${encodeURIComponent(item.actor.name)}`);
    }
  };

  const markAllRead = async () => {
    const result = await markAllNotificationsRead();
    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }
    setItems((prev) => prev.map((row) => ({ ...row, status: 'READ' as const })));
    setUnread(0);
    notify('Notificaciones marcadas como leídas.');
  };

  const important = items.filter((item) => IMPORTANT_NOTIFICATION_TYPES.has(item.type));
  const activity = items.filter((item) => !IMPORTANT_NOTIFICATION_TYPES.has(item.type));

  const renderRows = (rows: NotificationItem[]) =>
    rows.map((item) => {
      const { icon, text } = describeNotification(item);
      const unreadItem = item.status === 'UNREAD';
      const action =
        item.entityType === 'STORY'
          ? 'Ver relato'
          : item.entityType === 'CHARACTER'
            ? 'Ver perfil'
            : '';
      return (
        <button
          key={item.id}
          className={`notification card notification-link${unreadItem ? ' unread' : ''}`}
          type="button"
          onClick={() => void openItem(item)}
        >
          <span className="notification-icon">
            <Icon name={icon} />
          </span>
          <span>
            <b>{text}</b>
            <small>
              {unreadItem ? 'Nueva' : 'Leída'} · {notificationTime(item.createdAt)}
              {action ? ` · ${action}` : ''}
            </small>
          </span>
          <Icon name="chevron" />
        </button>
      );
    });

  if (loading) {
    return (
      <div className="wy" style={{ display: 'grid', placeItems: 'center' }}>
        <p className="muted">Verificando acceso…</p>
      </div>
    );
  }

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="notifications"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      unreadNotifications={unread}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen notifications-screen">
        <div className="screen-heading">
          <div>
            <h1>Notificaciones</h1>
            <p>Primero tus conversaciones y las historias que continúan.</p>
          </div>
          {unread > 0 ? (
            <button className="text-link" type="button" onClick={() => void markAllRead()}>
              Marcar todo como leído
            </button>
          ) : null}
        </div>

        {listLoading ? <p className="muted small">Cargando notificaciones…</p> : null}

        {!listLoading && error ? (
          <div className="auth-error" role="alert">
            {error}
            <button className="text-link" type="button" onClick={() => void loadNotifications()} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        ) : null}

        {!listLoading && !error && items.length === 0 ? (
          <div className="empty card">
            <div className="empty-icon">
              <Icon name="bell" />
            </div>
            <h2>Todo al día</h2>
            <p>Te avisaremos aquí cuando alguien te siga, comente o te acompañe.</p>
          </div>
        ) : null}

        {!listLoading && !error && important.length > 0 ? (
          <>
            <h2 className="notice-section-title">Conversaciones y actualizaciones</h2>
            {renderRows(important)}
          </>
        ) : null}

        {!listLoading && !error && activity.length > 0 ? (
          <>
            <h2 className="notice-section-title">Actividad agrupada</h2>
            {renderRows(activity)}
          </>
        ) : null}

        {!listLoading && !error && items.length > 0 ? (
          <p className="private-line">
            <Icon name="lock" /> Los avisos fuera de la aplicación no muestran el contenido de tus relatos o registros.
          </p>
        ) : null}
      </section>
    </WyFrame>
  );
}
