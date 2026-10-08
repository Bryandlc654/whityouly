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
import { followCharacter, listFollowing, unfollowCharacter, type FollowedCharacter } from '@/lib/follows';
import { listFollowingStories, viewStory, type FollowingStory, type MyStory } from '@/lib/stories';

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

    const [feedResult, followingResult] = await Promise.all([
      listFollowingStories({ cursor }),
      listFollowing(),
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
      case 'mood':
        notify('Mi estado emocional llega con el módulo del diario.');
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
      onSearch={() => notify('La búsqueda llega con el módulo de exploración.')}
      toast={toast}
      overlay={
        view ? (
          <div className="modal" role="dialog" aria-modal="true" aria-label={view.title}>
            <div className="modal-head">
              <div>
                <h2>{view.title}</h2>
                <p>{view.author ? `${view.author.name} · ` : ''}{view.updates.length} etapas</p>
              </div>
              <button className="close" type="button" onClick={() => setView(null)} aria-label="Cerrar">
                <Icon name="x" />
              </button>
            </div>

            <div className="stage-list" style={{ marginTop: 14 }}>
              {view.updates.map((stage) => (
                <div key={stage.id} className="stage-item">
                  <div className="stage-head">
                    <span>Etapa {stage.stageOrder}</span>
                  </div>
                  <p>{stage.content}</p>
                  {stage.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={stage.mediaUrl} alt="" style={{ marginTop: 10, borderRadius: 12, maxWidth: '100%' }} />
                  ) : null}
                  {stage.audioUrl ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio controls src={stage.audioUrl} style={{ width: '100%', marginTop: 10 }} />
                  ) : null}
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="ghost" type="button" onClick={() => setView(null)}>
                Cerrar
              </button>
            </div>
          </div>
        ) : null
      }
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onDaily={() => notify('La consigna diaria llega con el módulo de historias.')}
          onCategory={(category) => notify(`Explorar «${category}» llega pronto.`)}
          onMood={() => notify('Mi estado emocional llega con el módulo del diario.')}
        />
      }
    >
      <section className="screen">
        <div className="welcome-row">
          <div>
            <h1>Siguiendo</h1>
            <p className="muted small">
              {name
                ? `${name}, aquí llegan los relatos de los personajes que sigues.`
                : 'Relatos de los personajes que sigues.'}
            </p>
          </div>
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
                  className="chip on"
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
                        disabled={busyAuthor === story.author.name}
                        onClick={() => void toggleFollow(story.author.name)}
                      >
                        {isFollowing ? 'Siguiendo' : '+ Seguir autor'}
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
