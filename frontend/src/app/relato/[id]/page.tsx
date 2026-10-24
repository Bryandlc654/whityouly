'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import StoryViewer from '@/components/wy/StoryViewer';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import { viewStory, type MyStory } from '@/lib/stories';

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function StoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const storyId = typeof params?.id === 'string' ? params.id : '';

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<MyStory | null>(null);
  const [storyLoading, setStoryLoading] = useState(true);
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

  const loadStory = useCallback(async () => {
    if (!storyId) {
      setError('No encontramos ese relato.');
      setStoryLoading(false);
      return;
    }

    setStoryLoading(true);
    setError('');
    const result = await viewStory(storyId);
    setStoryLoading(false);

    if (result.status === 'ok') {
      setStory(result.data);
      return;
    }

    setStory(null);
    setError(result.message);
  }, [storyId]);

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
    if (!loading) void loadStory();
  }, [loading, loadStory]);

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
        router.push('/notificaciones');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  if (loading) {
    return (
      <div className="wy" style={{ display: 'grid', placeItems: 'center' }}>
        <p className="muted">Verificando acceso…</p>
      </div>
    );
  }

  const tags = story ? [...story.categories, ...story.tags].slice(0, 5) : [];

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="notifications"
      className="feed-reference"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen story-page">
        <button
          className="text-link story-back"
          type="button"
          onClick={() => router.push('/notificaciones')}
        >
          <Icon name="chevron" /> Volver a notificaciones
        </button>

        {storyLoading ? <p className="muted small">Cargando el relato…</p> : null}

        {!storyLoading && error ? (
          <div className="auth-error" role="alert">
            {error}
            <button className="text-link" type="button" onClick={() => void loadStory()} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        ) : null}

        {!storyLoading && !error && story ? (
          <article className="post card story-page-card">
            <div className="post-head">
              <Avatar
                initials={initialsOf(story.author?.name)}
                avatarUrl={story.author?.avatarUrl}
                size="sm"
              />
              <div>
                <div className="post-author">
                  <span className="author-name">{story.author?.name ?? 'Autor desconocido'}</span>
                </div>
                <div className="post-time">
                  {formatDate(story.createdAt)} · {story.updates.length}{' '}
                  {story.updates.length === 1 ? 'etapa' : 'etapas'}
                </div>
              </div>
            </div>

            {tags.length > 0 ? (
              <div className="post-tags">
                {tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <h1 className="story-page-title">{story.title}</h1>

            <div className="story-page-meta">
              <span>
                {story.supportCount} {story.supportCount === 1 ? 'persona está' : 'personas están'} contigo
              </span>
              <span>
                {story.commentCount} {story.commentCount === 1 ? 'comentario' : 'comentarios'}
              </span>
            </div>

            <StoryViewer
              story={story}
              variant="page"
              onNotify={notify}
              onClose={() => router.push('/notificaciones')}
            />
          </article>
        ) : null}
      </section>
    </WyFrame>
  );
}
