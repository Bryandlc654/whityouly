'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Avatar from '@/components/wy/Avatar';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import {
  listFollowing,
  unfollowCharacter,
  whatIFollow,
  type FollowedCharacter,
  type WhatIFollow,
} from '@/lib/follows';
import { unfollowStory } from '@/lib/interactions';

type FollowingTab = 'authors' | 'stories';

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

export default function FollowingPage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FollowingTab>('authors');

  const [following, setFollowing] = useState<FollowedCharacter[]>([]);
  const [sigo, setSigo] = useState<WhatIFollow | null>(null);
  const [error, setError] = useState('');
  const [busyAuthor, setBusyAuthor] = useState<string | null>(null);
  const [busyStory, setBusyStory] = useState<string | null>(null);

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

  const loadAll = useCallback(async () => {
    setError('');
    const [followingResult, sigoResult] = await Promise.all([listFollowing(), whatIFollow()]);

    if (followingResult.status === 'ok') {
      setFollowing(followingResult.data.items);
    } else {
      setError(followingResult.message);
    }

    if (sigoResult.status === 'ok') {
      setSigo(sigoResult.data);
    } else {
      setError(sigoResult.message);
      setSigo(null);
    }
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
    if (!loading) void loadAll();
  }, [loading, loadAll]);

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
        void loadAll();
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
      case 'notifications':
        router.push('/notificaciones');
        break;
      case 'help':
        router.push('/soporte');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const toggleFollow = async (authorName: string) => {
    setBusyAuthor(authorName);
    const result = await unfollowCharacter(authorName);
    setBusyAuthor(null);

    if (result.status === 'ok') {
      setFollowing((prev) => prev.filter((item) => item.name !== authorName));
      return;
    }

    notify(result.message);
  };

  const removeFollowedStory = async (storyId: string) => {
    setBusyStory(storyId);
    const result = await unfollowStory(storyId);
    setBusyStory(null);

    if (result.status === 'ok') {
      setSigo((prev) =>
        prev ? { ...prev, stories: prev.stories.filter((story) => story.id !== storyId) } : prev,
      );
      return;
    }

    notify(result.message);
  };

  const name = character?.name ?? '';

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
      activeRoute="following"
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
      <section className="screen following-page">
        <div className="screen-heading">
          <div>
            <h1>Siguiendo</h1>
            <p>{name ? `${name}, ` : ''}elige si quieres ver autores o historias que continúan.</p>
          </div>
        </div>

        <div className="segmented following-tabs">
          <button
            type="button"
            className={tab === 'authors' ? 'active' : undefined}
            aria-current={tab === 'authors' ? 'page' : undefined}
            onClick={() => setTab('authors')}
          >
            Autores
          </button>
          <button
            type="button"
            className={tab === 'stories' ? 'active' : undefined}
            aria-current={tab === 'stories' ? 'page' : undefined}
            onClick={() => setTab('stories')}
          >
            Relatos
          </button>
        </div>

        <p className="following-explainer">
          {tab === 'authors'
            ? 'Seguir a un autor muestra sus nuevos relatos en tu feed Siguiendo.'
            : 'Seguir un relato te avisa solo cuando el autor añade una continuación.'}
        </p>

        {error ? (
          <div className="auth-error" role="alert">
            {error}
            <button className="text-link" type="button" onClick={() => void loadAll()} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        ) : null}

        {!error && tab === 'authors' ? (
          following.length > 0 ? (
            <div className="following-list">
              {following.map((person) => (
                <article key={person.name} className="card follow-row following-author">
                  <Avatar
                    initials={initialsOf(person.name)}
                    avatarUrl={person.avatarUrl}
                    size="sm"
                  />
                  <div>
                    <button
                      className="author-name"
                      type="button"
                      onClick={() => router.push(`/personaje/${encodeURIComponent(person.name)}`)}
                    >
                      {person.name}
                    </button>
                    {person.tagline ? <small>{person.tagline}</small> : null}
                  </div>
                  <button
                    className="secondary"
                    type="button"
                    disabled={busyAuthor === person.name}
                    onClick={() => void toggleFollow(person.name)}
                  >
                    Siguiendo
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>Aún no sigues autores</h2>
              <p>Explora relatos y encuentra personas con las que conectar.</p>
              <button className="secondary" type="button" onClick={() => router.push('/explorar')}>
                Explorar relatos
              </button>
            </div>
          )
        ) : null}

        {!error && tab === 'stories' ? (
          sigo && sigo.stories.length > 0 ? (
            <div className="story-list following-list">
              {sigo.stories.map((story) => (
                <article key={story.id} className="card following-story">
                  <div>
                    <h3>
                      <button
                        className="story-title-button"
                        type="button"
                        onClick={() => router.push(`/relato/${story.id}`)}
                      >
                        {story.title}
                      </button>
                    </h3>
                    <p>{story.author.name}</p>
                  </div>
                  <div className="story-row-actions">
                    <button className="secondary" type="button" onClick={() => router.push(`/relato/${story.id}`)}>
                      Leer relato
                    </button>
                    <button
                      className="text-link danger"
                      type="button"
                      disabled={busyStory === story.id}
                      onClick={() => void removeFollowedStory(story.id)}
                    >
                      Dejar de seguir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>Aún no sigues relatos</h2>
              <p>Cuando sigas un relato, aparecerá aquí para que no pierdas sus continuaciones.</p>
              <button className="secondary" type="button" onClick={() => router.push('/feed')}>
                Ir al feed
              </button>
            </div>
          )
        ) : null}

      </section>
    </WyFrame>
  );
}
