'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from './Shell';
import RightRail from './RightRail';
import { Sheet, type SheetRow } from './Overlays';
import NotificationsPanel from './NotificationsPanel';
import StoryViewer from './StoryViewer';
import { unreadNotificationsCount } from '@/lib/notifications';

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

/**
 * Envuelve contenido de servidor (como un perfil público) con el marco de la
 * app: barra superior, navegación lateral, rail derecho y cuenta. El contenido
 * se renderiza en el servidor y se pasa como `children`.
 */
export default function ProfileShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reader, setReader] = useState<{ id: string; title: string } | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? '' : current)), 2400);
  }, []);

  useEffect(() => {
    // La página es pública: sin sesión no se pide nada.
    if (!tokenStorage.getAccess()) return;

    void (async () => {
      try {
        const res = await authFetch(`${API_URL}/characters/me`);
        if (res.ok) setCharacter(await res.json());
      } catch {
        /* la barra se muestra sin avatar */
      }
    })();

    void unreadNotificationsCount().then((result) => {
      if (result.status === 'ok') setUnreadCount(result.data.count);
    });
  }, []);

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
        { label: 'Lo que sigo', icon: 'users', onClick: () => router.push('/siguiendo') },
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
        { label: 'Configuración de la cuenta', icon: 'settings', onClick: () => router.push('/cuenta') },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        router.push('/feed');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'profile':
        router.push('/cuenta');
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
      case 'notifications':
        setNotificationsOpen(true);
        break;
      case 'character':
        break;
      case 'help':
        notify('Ayuda, privacidad y recursos de apoyo llegarán pronto.');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="character"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      unreadNotifications={unreadCount}
      overlay={
        notificationsOpen ? (
          <NotificationsPanel
            onClose={() => setNotificationsOpen(false)}
            onUnreadChange={setUnreadCount}
            onOpenStory={(storyId) => {
              setNotificationsOpen(false);
              setReader({ id: storyId, title: '' });
            }}
            onOpenCharacter={(name) => {
              setNotificationsOpen(false);
              router.push(`/personaje/${encodeURIComponent(name)}`);
            }}
          />
        ) : reader ? (
          <StoryViewer storyId={reader.id} title={reader.title} onClose={() => setReader(null)} />
        ) : null
      }
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onDaily={() => notify('La consigna diaria llega con el módulo de historias.')}
          onCategory={(category) => {
            router.push(`/explorar?category=${encodeURIComponent(category)}`);
          }}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      {children}
    </WyFrame>
  );
}
