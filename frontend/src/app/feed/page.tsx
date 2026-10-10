'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';
import PostCard from '@/components/wy/PostCard';
import RightRail from '@/components/wy/RightRail';
import MoodModal, { MOODS } from '@/components/wy/MoodModal';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import CommentSection from '@/components/wy/CommentSection';
import StoryForm from '@/components/wy/StoryForm';
import { followCharacter, listFollowing, unfollowCharacter } from '@/lib/follows';
import { followStory, supportStory, unfollowStory, unsupportStory } from '@/lib/interactions';
import { saveStory, unsaveStory } from '@/lib/bookmarks';
import { getFeed, type FeedSections, type FollowingStory } from '@/lib/stories';
import { getFeaturedStories, type FeaturedStory } from '@/lib/discovery';
import { unreadNotificationsCount } from '@/lib/notifications';
import NotificationsPanel from '@/components/wy/NotificationsPanel';
import type { DemoStory } from '@/components/wy/feedData';

interface FeedEntry extends DemoStory {
  isOwn: boolean;
  status?: 'DRAFT' | 'PUBLISHED';
  mediaUrl?: string | null;
  audioUrl?: string | null;
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

function toEntry(story: FollowingStory, authorName: string): FeedEntry {
  const isOwn = story.author.name === authorName;
  return {
    id: story.id,
    author: story.author.name,
    initials: initialsOf(story.author.name),
    time: relativeTime(story.createdAt),
    category: story.categories[0] ?? 'Relato',
    updateKind: story.stageCount > 1 ? `Evolución · ${story.stageCount} etapas` : 'Relato',
    updateDate: relativeTime(story.updatedAt),
    updateText: '',
    title: story.title,
    text: story.opening?.content ?? '',
    support: story.supportCount,
    comments: story.commentCount,
    mediaUrl: story.opening?.mediaUrl ?? null,
    audioUrl: story.opening?.audioUrl ?? null,
    isOwn,
    ...(isOwn ? { status: 'PUBLISHED' as const } : {}),
  };
}

function allEmpty(sections: FeedSections | null): boolean {
  if (!sections) return true;
  return (
    sections.recent.length === 0 &&
    sections.recommended.length === 0 &&
    sections.popular.length === 0 &&
    sections.following.length === 0
  );
}

export default function FeedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState<CharacterSummary | null>(null);

  const [sections, setSections] = useState<FeedSections | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState('');

  const [followedAuthors, setFollowedAuthors] = useState<Set<string>>(new Set());
  const [supported, setSupported] = useState<Set<string>>(new Set());
  const [supportCounts, setSupportCounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [followStories, setFollowStories] = useState<Set<string>>(new Set());

  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsStory, setCommentsStory] = useState<FollowingStory | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodName, setMoodName] = useState('Esperanza');
  const [moodValue, setMoodValue] = useState(7);
  const [moodDaypart, setMoodDaypart] = useState('Todo el día');

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [featured, setFeatured] = useState<FeaturedStory[]>([]);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const composerRef = useRef<HTMLElement>(null);
  const followingRef = useRef<HTMLElement>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // Al abrir el compositor en línea, se lleva a la vista (puede estar arriba).
  useEffect(() => {
    if (composerOpen) composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [composerOpen]);

  useEffect(() => {
    const verifySession = async () => {
      const token = tokenStorage.getAccess();

      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const res = await authFetch(`${API_URL}/characters/me`);

        if (res.status === 401) {
          tokenStorage.clear();
          router.push('/login');
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (data) setCharacter(data);
        }
      } catch (error) {
        console.error('Error verificando sesión', error);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [router]);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    setFeedError('');

    const [feed, follows, featuredResult, unread] = await Promise.all([
      getFeed(),
      listFollowing(),
      getFeaturedStories(),
      unreadNotificationsCount(),
    ]);

    if (follows.status === 'ok') {
      setFollowedAuthors(new Set(follows.data.items.map((item) => item.name)));
    }

    if (featuredResult.status === 'ok') {
      setFeatured(featuredResult.data.items);
    }

    if (unread.status === 'ok') {
      setUnreadCount(unread.data.count);
    }

    if (feed.status !== 'ok') {
      setFeedError('No se pudo cargar el feed.');
      setSections(null);
      setFeedLoading(false);
      return;
    }

    setSections(feed.data);
    setFeedLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) void loadFeed();
  }, [loading, loadFeed]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Mis relatos', icon: 'book', onClick: () => router.push('/mis-relatos') },
        { label: 'Configuración de la cuenta', icon: 'settings', onClick: () => router.push('/cuenta') },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  const openMood = (name = 'Esperanza') => {
    setMoodName(name);
    setMoodOpen(true);
  };

  const toggleFollowAuthor = async (authorName: string) => {
    const isFollowing = followedAuthors.has(authorName);
    const result = isFollowing ? await unfollowCharacter(authorName) : await followCharacter(authorName);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setFollowedAuthors((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(authorName);
      else next.add(authorName);
      return next;
    });
    notify(isFollowing ? `Dejaste de seguir a ${authorName}.` : `Ahora sigues a ${authorName}.`);
  };

  const toggleSupport = async (storyId: string) => {
    const active = supported.has(storyId);
    const result = active ? await unsupportStory(storyId) : await supportStory(storyId);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setSupported((prev) => {
      const next = new Set(prev);
      if (active) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
    setSupportCounts((prev) => ({ ...prev, [storyId]: result.data.count }));
    notify(active ? 'Quitaste tu apoyo.' : 'Tu apoyo fue enviado.');
  };

  const toggleFollowStory = async (storyId: string) => {
    const active = followStories.has(storyId);
    const result = active ? await unfollowStory(storyId) : await followStory(storyId);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setFollowStories((prev) => {
      const next = new Set(prev);
      if (active) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
    notify(
      active
        ? 'Dejaste de seguir sus actualizaciones.'
        : 'Seguirás las actualizaciones de este relato.',
    );
  };

  const toggleSave = async (storyId: string) => {
    const active = saved.has(storyId);
    const result = active ? await unsaveStory(storyId) : await saveStory(storyId);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setSaved((prev) => {
      const next = new Set(prev);
      if (active) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
    notify(active ? 'Relato eliminado de guardados.' : 'Relato guardado en privado.');
  };

  const openPostMenu = (storyId: string) => {
    setSheet({
      title: 'Opciones del relato',
      rows: [
        { label: 'Seguir actualizaciones', icon: 'bell', onClick: () => void toggleFollowStory(storyId) },
        { label: 'Guardar relato', icon: 'bookmark', onClick: () => void toggleSave(storyId) },
        { label: 'Compartir enlace', icon: 'share', onClick: () => notify('Enlace copiado') },
        { label: 'Reportar contenido', icon: 'flag', danger: true, onClick: () => notify('Reporte enviado a revisión prioritaria') },
      ],
    });
  };

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'following':
        followingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'mood':
        openMood();
        break;
      case 'notifications':
        setNotificationsOpen(true);
        break;
      case 'help':
        notify('Ayuda, privacidad y recursos de apoyo llegarán pronto.');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'my-stories':
        setComposerOpen(true);
        break;
      case 'explore':
        router.push('/explorar');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const renderCard = (story: FollowingStory, index: number, authorName: string) => {
    const entry = toEntry(story, authorName);
    return (
      <div
        key={story.id}
        className="story-enter"
        style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      >
        <PostCard
          story={entry}
          isOwn={entry.isOwn}
          statusLabel={entry.status}
          mediaUrl={entry.mediaUrl}
          audioUrl={entry.audioUrl}
          supported={supported.has(entry.id)}
          supportCount={supportCounts[entry.id]}
          saved={saved.has(entry.id)}
          followingAuthor={followedAuthors.has(entry.author)}
          followingStory={followStories.has(entry.id)}
          onSupport={() => void toggleSupport(entry.id)}
          onSave={() => void toggleSave(entry.id)}
          onFollowAuthor={() => void toggleFollowAuthor(entry.author)}
          onFollowStory={() => void toggleFollowStory(entry.id)}
          onOpenMenu={() => openPostMenu(entry.id)}
          onPlay={() => notify('Reproduciendo vista previa')}
          onAuthor={() => router.push(`/personaje/${encodeURIComponent(entry.author)}`)}
          onComment={() => setCommentsStory(story)}
        />
      </div>
    );
  };

  const renderSection = (
    title: string,
    items: FollowingStory[],
    authorName: string,
    anchorId?: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <section className="feed-group" id={anchorId} ref={anchorId === 'seguidos' ? followingRef : undefined}>
        <h2 className="feed-group-title">{title}</h2>
        {items.map((story, index) => renderCard(story, index, authorName))}
      </section>
    );
  };

  const renderFeatured = (items: FeaturedStory[]) => {
    if (items.length === 0) return null;
    return (
      <section className="feed-group">
        <h2 className="feed-group-title">Contenido destacado</h2>
        <div className="featured-strip">
          {items.map((story) => (
            <article key={story.id} className="card featured-card">
              <span className="featured-label">
                <Icon name="sparkle" />
                {story.note || 'Destacado'}
              </span>
              <h3>{story.title}</h3>
              <p className="story-row-meta">
                <Icon name="user" />
                <span>{story.author.name}</span>
                {story.categories[0] ? (
                  <>
                    <span className="dot" aria-hidden />
                    <span>{story.categories[0]}</span>
                  </>
                ) : null}
              </p>
              {story.opening?.content ? <p className="post-text clamp">{story.opening.content}</p> : null}
              {story.opening?.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={story.opening.mediaUrl} alt="" className="post-media" />
              ) : null}
              <div className="story-row-actions">
                <button className="action-link" type="button" onClick={() => setCommentsStory(story)}>
                  <Icon name="book" /> Leer historia
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  };

  if (loading) {
    return (
      <div className="wy" style={{ display: 'grid', placeItems: 'center' }}>
        <p className="muted">Verificando acceso…</p>
      </div>
    );
  }

  const name = character?.name ?? '';
  const initials = initialsOf(character?.name);

  return (
    <WyFrame
      characterInitials={initials}
      avatarUrl={character?.avatarUrl}
      activeRoute="home"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      onSearch={() => router.push('/explorar')}
      toast={toast}
      unreadNotifications={unreadCount}
      overlay={
        notificationsOpen ? (
          <NotificationsPanel
            onClose={() => setNotificationsOpen(false)}
            onOpenStory={(storyId) => {
              setNotificationsOpen(false);
              setCommentsStory({ id: storyId, title: '' } as FollowingStory);
            }}
            onOpenCharacter={(name) => {
              setNotificationsOpen(false);
              router.push(`/personaje/${encodeURIComponent(name)}`);
            }}
          />
        ) : commentsStory ? (
          <div className="modal" role="dialog" aria-modal="true" aria-label="Comentarios">
            <div className="modal-head">
              <div>
                <h2>Comentarios</h2>
                <p>{commentsStory.title}</p>
              </div>
              <button className="close" type="button" onClick={() => setCommentsStory(null)} aria-label="Cerrar">
                <Icon name="x" />
              </button>
            </div>
            <CommentSection storyId={commentsStory.id} onNotify={notify} />
          </div>
        ) : moodOpen ? (
          <MoodModal
            name={moodName}
            value={moodValue}
            daypart={moodDaypart}
            onChangeName={setMoodName}
            onChangeValue={setMoodValue}
            onChangeDaypart={setMoodDaypart}
            onClose={() => setMoodOpen(false)}
            onSave={() => {
              setMoodOpen(false);
              notify(`${moodName} ${moodValue}/10 guardado de forma privada`);
            }}
          />
        ) : null
      }
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onDaily={() => notify('La consigna diaria llega con el módulo de historias.')}
          onCategory={(category) => notify(`Explorar «${category}» llega pronto.`)}
          onMood={openMood}
        />
      }
    >
      <section className="screen">
        <div className="welcome-row">
          <div>
            <h1>Hola, {name || 'invitado'}</h1>
            <p className="muted small">Este es un espacio para sentirte acompañado.</p>
          </div>
          <button className="secondary" type="button" onClick={() => openMood()}>
            <Icon name="pulse" /> Registrar estado
          </button>
        </div>

        <section className="quick-mood card">
          <div className="quick-title">
            <div>
              <h2>¿Cómo estás ahora?</h2>
              <p>Regístralo en menos de 10 segundos</p>
            </div>
            <span className="small">Privado</span>
          </div>
          <div className="mood-choices">
            {MOODS.map((mood) => (
              <button
                key={mood.name}
                className="mood-choice"
                type="button"
                onClick={() => openMood(mood.name)}
              >
                <span>{mood.glyph}</span>
                <small>{mood.name}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="composer card" ref={composerRef}>
          <div className="composer-top">
            <Avatar initials={initials} avatarUrl={character?.avatarUrl} />
            {composerOpen ? (
              <div>
                <b>{name || 'tu seudónimo'}</b>
                <div className="post-time">Publicarás con este seudónimo</div>
              </div>
            ) : (
              <button
                className="composer-trigger"
                type="button"
                onClick={() => setComposerOpen(true)}
              >
                ¿Qué necesitas sacar de tu pecho hoy?
              </button>
            )}
          </div>

          {composerOpen ? (
            <StoryForm
              variant="minimal"
              onCreated={() => {
                setComposerOpen(false);
                notify('Tu relato se guardó.');
                void loadFeed();
              }}
              onCancel={() => setComposerOpen(false)}
            />
          ) : (
            <div className="composer-meta">
              <span>
                <Icon name="lock" /> Publicarás como <strong>{name || 'tu seudónimo'}</strong>
              </span>
              <button className="text-link" type="button" onClick={() => setComposerOpen(true)}>
                Responder consigna diaria
              </button>
            </div>
          )}
        </section>

        {feedError ? (
          <div className="auth-error" role="alert">
            {feedError}
            <button className="text-link" type="button" onClick={() => void loadFeed()} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        ) : null}

        {feedLoading ? <p className="muted small">Preparando tu feed…</p> : null}

        <div id="feedList" className="stack">
          {renderFeatured(featured)}
          {renderSection('Historias recientes', sections?.recent ?? [], name)}
          {renderSection('Recomendadas para ti', sections?.recommended ?? [], name)}
          {renderSection('Historias populares', sections?.popular ?? [], name)}
          {renderSection('De personas que sigues', sections?.following ?? [], name, 'seguidos')}

          {!feedLoading && !feedError && allEmpty(sections) ? (
            <div className="empty card">
              <div className="empty-icon">
                <Icon name="book" />
              </div>
              <h2>Todavía no hay relatos</h2>
              <p>Sé la primera persona en compartir. Tu relato aparecerá aquí.</p>
              <button
                className="primary"
                type="button"
                style={{ padding: '12px 18px' }}
                onClick={() => setComposerOpen(true)}
              >
                Compartir un relato
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </WyFrame>
  );
}