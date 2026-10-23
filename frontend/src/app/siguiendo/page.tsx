'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import StoryViewer from '@/components/wy/StoryViewer';
import {
  followCharacter,
  listFollowing,
  unfollowCharacter,
  whatIFollow,
  type FollowedCharacter,
  type WhatIFollow,
} from '@/lib/follows';
import { listFollowingStories, viewStory, type FollowingStory, type MyStory } from '@/lib/stories';
import { unfollowStory } from '@/lib/interactions';
import { listSavedStories, unsaveStory, type SavedStory } from '@/lib/bookmarks';

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

export default function FollowingPage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [feed, setFeed] = useState<FollowingStory[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [feedError, setFeedError] = useState('');
  const [following, setFollowing] = useState<FollowedCharacter[]>([]);
  const [sigo, setSigo] = useState<WhatIFollow | null>(null);
  const [saved, setSaved] = useState<SavedStory[]>([]);
  const [busyAuthor, setBusyAuthor] = useState<string | null>(null);

  const [view, setView] = useState<MyStory | null>(null);
  const [viewBusy, setViewBusy] = useState(false);

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

  const loadAll = useCallback(async (cursor?: string) => {
    if (!cursor) setFeedError('');

    const [feedResult, followingResult, sigoResult, savedResult] = await Promise.all([
      listFollowingStories({ cursor }),
      listFollowing(),
      whatIFollow(),
      listSavedStories(),
    ]);

    if (feedResult.status === 'ok') {
      setFeed((prev) => (cursor ? [...prev, ...feedResult.data.items] : feedResult.data.items));
      setNextCursor(feedResult.data.nextCursor);
    } else {
      setFeedError(feedResult.message);
      if (!cursor) setFeed([]);
    }

    if (followingResult.status === 'ok') {
      setFollowing(followingResult.data.items);
    }
    if (sigoResult.status === 'ok') {
      setSigo(sigoResult.data);
    }
    if (savedResult.status === 'ok') {
      setSaved(savedResult.data.items);
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
      } catch (error) {
        console.error('Error verificando sesión', error);
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
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const toggleFollow = async (authorName: string) => {
    setBusyAuthor(authorName);
    const isFollowing = following.some((item) => item.name === authorName);
    const result = isFollowing ? await unfollowCharacter(authorName) : await followCharacter(authorName);
    setBusyAuthor(null);

    if (result.status === 'ok') {
      notify(isFollowing ? `Dejaste de seguir a ${authorName}.` : `Ahora sigues a ${authorName}.`);
      void loadAll();
      return;
    }
    notify(result.message);
  };

  const unfollowFollowedStory = async (storyId: string) => {
    const result = await unfollowStory(storyId);
    if (result.status === 'ok') {
      setSigo((prev) =>
        prev ? { ...prev, stories: prev.stories.filter((story) => story.id !== storyId) } : prev,
      );
      notify('Dejaste de seguir esta historia.');
      return;
    }
    notify(result.message);
  };

  const unsave = async (storyId: string) => {
    const result = await unsaveStory(storyId);
    if (result.status === 'ok') {
      setSaved((prev) => prev.filter((item) => item.id !== storyId));
      notify('Quitado de tus guardados.');
      return;
    }
    notify(result.message);
  };

  const openStory = async (storyId: string) => {
    setViewBusy(true);
    const result = await viewStory(storyId);
    setViewBusy(false);

    if (result.status === 'ok') {
      setView(result.data);
      return;
    }
    notify(result.message);
  };

  const name = character?.name ?? '';

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="following"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      overlay={
        view ? <StoryViewer story={view} onClose={() => setView(null)} />
          : null
      }
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onDaily={() => notify('La consigna diaria llega con el módulo de historias.')}
          onCategory={(category) => notify(`Explorar «${category}» llega pronto.`)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen">
        <div className="welcome-row">
          <div>
            <h1>Lo que sigo</h1>
            <p className="muted small">
              {name
                ? `${name}, aquí estás al día de lo que te importa.`
                : 'Lo que sigues y guardas.'}
            </p>
          </div>
          {name ? (
            <button
              className="secondary"
              type="button"
              onClick={() => router.push(`/seguidores/${encodeURIComponent(name)}`)}
            >
              Ver mis seguidores
            </button>
          ) : null}
        </div>

        {following.length > 0 ? (
          <section className="card pad">
            <h2 className="h-section" style={{ marginBottom: 10 }}>
              Personajes que sigues
            </h2>
            <div className="chip-row">
              {following.map((person) => (
                <button
                  key={person.name}
                  type="button"
                  className="chip on follow-chip"
                  disabled={busyAuthor === person.name}
                  onClick={() => void toggleFollow(person.name)}
                  title="Dejar de seguir"
                >
                  {person.name} · Dejar de seguir
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {sigo && sigo.stories.length > 0 ? (
          <section className="card pad">
            <h2 className="h-section" style={{ marginBottom: 10 }}>
              Historias que sigues
            </h2>
            <div className="stack">
              {sigo.stories.map((story) => (
                <div key={story.id} className="row-between">
                  <div style={{ minWidth: 0 }}>
                    <b>{story.title}</b>
                    <p className="hint" style={{ margin: 0 }}>
                      {story.author.name}
                    </p>
                  </div>
                  <button
                    className="link-danger"
                    type="button"
                    onClick={() => void unfollowFollowedStory(story.id)}
                  >
                    Dejar de seguir
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {saved.length > 0 ? (
          <section className="card pad">
            <h2 className="h-section" style={{ marginBottom: 10 }}>
              Guardados
            </h2>
            <div className="story-list" style={{ gap: 8 }}>
              {saved.map((item) => (
                <div key={item.id} className="row-between">
                  <div style={{ minWidth: 0 }}>
                    <b>{item.title}</b>
                    <p className="hint" style={{ margin: 0 }}>
                      {item.author ? item.author.name : 'Relato'}
                    </p>
                  </div>
                  <button className="link-danger" type="button" onClick={() => void unsave(item.id)}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {loading ? <p className="muted small">Verificando acceso…</p> : null}

        {!loading && feedError ? (
          <div className="auth-error" role="alert">
            {feedError}
            <button className="text-link" type="button" onClick={() => void loadAll()} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        ) : null}

        {!loading && !feedError && feed.length === 0 ? (
          <div className="empty card">
            <div className="empty-icon">
              <Icon name="users" />
            </div>
            <h2>Aún no sigues a nadie</h2>
            <p>Explora autores con los que conectes. Aquí aparecerán sus nuevos relatos.</p>
            <button
              className="primary"
              type="button"
              style={{ padding: '12px 18px' }}
              onClick={() => router.push('/feed')}
            >
              Explorar el feed
            </button>
          </div>
        ) : null}

        <div className="stack">
          {feed.map((story) => {
            const isFollowing = following.some((item) => item.name === story.author.name);
            return (
              <article key={story.id} className="post card story-card">
                <div className="post-head">
                  <Avatar initials={initialsOf(story.author.name)} avatarUrl={story.author.avatarUrl} />
                  <div>
                    <div className="post-author">
                      <span>{story.author.name}</span>
                      <button
                        type="button"
                        key={isFollowing ? 'following' : 'follow'}
                        className={`follow-btn${isFollowing ? ' on' : ''}`}
                        aria-pressed={isFollowing}
                        disabled={busyAuthor === story.author.name}
                        onClick={() => void toggleFollow(story.author.name)}
                      >
                        <Icon name={isFollowing ? 'check' : 'plus'} />
                        {isFollowing ? 'Siguiendo' : 'Seguir autor'}
                      </button>
                    </div>
                    <div className="post-time">
                      {story.stageCount} {story.stageCount === 1 ? 'etapa' : 'etapas'}
                    </div>
                  </div>
                </div>

                {story.categories.length > 0 ? (
                  <div className="post-tags" style={{ marginBottom: 0 }}>
                    {story.categories.slice(0, 2).map((category) => (
                      <span key={category} className="tag">
                        {category}
                      </span>
                    ))}
                  </div>
                ) : null}

                <h2 style={{ margin: 0 }}>{story.title}</h2>
                {story.opening ? <p className="post-text clamp">{story.opening.content}</p> : null}

                <div>
                  <button
                    className="secondary"
                    type="button"
                    disabled={viewBusy}
                    onClick={() => void openStory(story.id)}
                  >
                    Leer relato
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {nextCursor ? (
          <div>
            <button
              className="btn-outline"
              type="button"
              onClick={() => void loadAll(nextCursor)}
            >
              Ver más
            </button>
          </div>
        ) : null}
      </section>
    </WyFrame>
  );
}
