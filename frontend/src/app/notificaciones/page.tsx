'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Icon from '@/components/wy/Icon';
import type { IconName } from '@/components/wy/icons';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import PageSkeleton from '@/components/wy/PageSkeleton';

interface DemoNotice {
  id: string;
  group: 'important' | 'activity';
  icon: IconName;
  text: string;
  action: string;
  href: string;
}

const NOTICES: DemoNotice[] = [
  {
    id: 'comment-demo',
    group: 'important',
    icon: 'message',
    text: 'VolverAEmpezar dejó unas palabras en tu relato.',
    action: 'Ver conversación',
    href: '/feed',
  },
  {
    id: 'update-demo',
    group: 'important',
    icon: 'trend',
    text: 'LuzEnPausa añadió una continuación a su relato.',
    action: 'Ver continuación',
    href: '/feed',
  },
  {
    id: 'summary-demo',
    group: 'important',
    icon: 'pulse',
    text: 'Tu resumen emocional está disponible en Mi espacio.',
    action: 'Ver resumen',
    href: '/mi-estado',
  },
  {
    id: 'author-demo',
    group: 'activity',
    icon: 'heart',
    text: 'CalmaDeDomingo comenzó a seguir tu perfil.',
    action: 'Ver perfil',
    href: '/personaje/CalmaDeDomingo',
  },
  {
    id: 'support-demo',
    group: 'activity',
    icon: 'heart',
    text: 'Hay personas que están contigo en tu relato.',
    action: 'Ver relato',
    href: '/feed',
  },
];

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

export default function NotificationsPage() {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(NOTICES.map((notice) => notice.id));
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
        {
          label: 'Configuración de la cuenta',
          icon: 'settings',
          onClick: () => router.push('/cuenta/configuracion'),
        },
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
        router.push('/mi-espacio');
        break;
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'help':
        router.push('/ayuda');
        break;
      case 'notifications':
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const markAllRead = () => {
    setUnread([]);
    notify('Notificaciones marcadas como leídas.');
  };

  const renderRows = (group: DemoNotice['group']) =>
    NOTICES.filter((notice) => notice.group === group).map((notice) => {
      const isUnread = unread.includes(notice.id);
      return (
        <button
          key={notice.id}
          className={`notification card notification-link${isUnread ? ' unread' : ''}`}
          type="button"
          onClick={() => {
            setUnread((prev) => prev.filter((id) => id !== notice.id));
            router.push(notice.href);
          }}
        >
          <span className="notification-icon">
            <Icon name={notice.icon} />
          </span>
          <span>
            <b>{notice.text}</b>
            <small>
              {isUnread ? 'Nueva' : 'Leída'} · {notice.action}
            </small>
          </span>
          <Icon name="chevron" />
        </button>
      );
    });

  if (loading) {
    return (
      <PageSkeleton variant="list" />
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
      unreadNotifications={unread.length}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen">
        <div className="screen-heading">
          <div>
            <h1>Notificaciones</h1>
            <p>Primero tus conversaciones y las historias que continúan.</p>
          </div>
          <button className="text-link" type="button" onClick={markAllRead}>
            Marcar todo como leído
          </button>
        </div>

        <h2 className="notice-section-title">Conversaciones y actualizaciones</h2>
        {renderRows('important')}

        <h2 className="notice-section-title">Actividad agrupada</h2>
        {renderRows('activity')}

        <p className="private-line">
          <Icon name="lock" /> Los avisos fuera de la aplicación no muestran el contenido de tus
          relatos o registros.
        </p>
      </section>
    </WyFrame>
  );
}
