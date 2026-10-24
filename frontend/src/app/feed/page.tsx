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
import StoryViewer from '@/components/wy/StoryViewer';
import StoryForm from '@/components/wy/StoryForm';
import { followCharacter, listFollowing, unfollowCharacter } from '@/lib/follows';
import { followStory, supportStory, unfollowStory, unsupportStory } from '@/lib/interactions';
import { saveStory, unsaveStory } from '@/lib/bookmarks';
import { getFeed, reportStory, type FollowingStory } from '@/lib/stories';
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from '@/lib/moderation';
import { unreadNotificationsCount } from '@/lib/notifications';
import type { FeedStory } from '@/components/wy/feedData';
import { createEmotionalLog, daypartToLoggedAt } from '@/lib/emotionalMap';

interface FeedEntry extends FeedStory {
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

export default function FeedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState<CharacterSummary | null>(null);

  const [feedItems, setFeedItems] = useState<FollowingStory[] | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState('');

  const [followedAuthors, setFollowedAuthors] = useState<Set<string>>(new Set());
  const [supported, setSupported] = useState<Set<string>>(new Set());
  const [supportCounts, setSupportCounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [followStories, setFollowStories] = useState<Set<string>>(new Set());

  const [composerOpen, setComposerOpen] = useState(false);
  const [reader, setReader] = useState<{ id: string; title: string } | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodName, setMoodName] = useState('Esperanza');
  const [moodValue, setMoodValue] = useState(7);
  const [moodNote, setMoodNote] = useState('');
  const [moodDaypart, setMoodDaypart] = useState('Todo el día');
  const [moodSaving, setMoodSaving] = useState(false);
  const [moodError, setMoodError] = useState('');

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [feedTab, setFeedTab] = useState<'for-you' | 'following'>('for-you');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const composerRef = useRef<HTMLElement>(null);

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

        // Sin personaje no hay feed posible: primero se elige el seudónimo.
        if (res.status === 404) {
          router.replace('/onboarding');
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

  const loadFeed = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setFeedLoading(true);
    setFeedError('');

    const [feed, follows, unread] = await Promise.all([
      getFeed(),
      listFollowing(),
      unreadNotificationsCount(),
    ]);

    if (follows.status === 'ok') {
      setFollowedAuthors(new Set(follows.data.items.map((item) => item.name)));
    }

    if (unread.status === 'ok') {
      setUnreadCount(unread.data.count);
    }

    if (feed.status !== 'ok') {
      setFeedError('No se pudo cargar el feed.');
      setFeedItems(null);
      setFeedLoading(false);
      return;
    }

    setFeedItems(feed.data.items);
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
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
        { label: 'Ayuda y soporte', icon: 'mail', onClick: () => router.push('/soporte') },
        { label: 'Configuración de la cuenta', icon: 'settings', onClick: () => router.push('/cuenta') },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  const openMood = (name = 'Esperanza') => {
    setMoodName(name);
    setMoodNote('');
    setMoodError('');
    setMoodOpen(true);
  };

  const openIntro = () => {
    setSheet({
      title: 'Cómo empezar',
      rows: [
        { label: 'Registrar cómo me siento', icon: 'pulse', onClick: () => openMood() },
        { label: 'Explorar relatos', icon: 'search', onClick: () => router.push('/explorar') },
        { label: 'Cuidar mi espacio', icon: 'trend', onClick: () => router.push('/mi-estado') },
        { label: 'Ayuda y seguridad', icon: 'shield', onClick: () => router.push('/soporte') },
      ],
    });
  };

  const saveMood = async () => {
    setMoodSaving(true);
    setMoodError('');

    const result = await createEmotionalLog({
      emotion: moodName,
      intensity: moodValue,
      contextNote: moodNote.trim() || undefined,
      loggedAt: daypartToLoggedAt(moodDaypart),
    });

    setMoodSaving(false);

    if (result.status !== 'ok') {
      setMoodError(result.message);
      return;
    }

    setMoodOpen(false);
    setMoodNote('');
    notify(`${moodName} ${moodValue}/10 guardado de forma privada`);
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

    // El algoritmo pondera a los autores seguidos, así que se reordena el feed
    // sin bloquear la vista: los relatos de quien acabas de seguir suben solos.
    void loadFeed({ silent: true });
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
        {
          label: 'Reportar contenido',
          icon: 'flag',
          danger: true,
          onClick: () => openReportMenu(storyId),
        },
      ],
    });
  };

  const openReportMenu = (storyId: string) => {
    setSheet({
      title: '¿Por qué lo reportas?',
      rows: REPORT_REASONS.map((reason) => ({
        label: REPORT_REASON_LABELS[reason],
        icon: 'flag' as const,
        onClick: () => void submitStoryReport(storyId, reason),
      })),
    });
  };

  const submitStoryReport = async (storyId: string, reason: ReportReason) => {
    setSheet(null);
    const result = await reportStory(storyId, reason);
    notify(result.status === 'ok' ? 'Reporte enviado a revisión.' : result.message);
  };

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'following':
        router.push('/siguiendo');
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
          onComment={() => setReader({ id: story.id, title: story.title })}
          onShare={() => notify('Enlace copiado')}
        />
      </div>
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
  const visibleFeed =
    feedTab === 'following'
      ? (feedItems ?? []).filter((story) => followedAuthors.has(story.author.name))
      : (feedItems ?? []);

  return (
    <WyFrame
      characterInitials={initials}
      avatarUrl={character?.avatarUrl}
      activeRoute="home"
      className="feed-reference"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      unreadNotifications={unreadCount}
      overlay={
        reader ? (
          <StoryViewer
            storyId={reader.id}
            title={reader.title}
            onNotify={notify}
            onClose={() => setReader(null)}
          />
        ) : moodOpen ? (
          <MoodModal
            name={moodName}
            value={moodValue}
            note={moodNote}
            daypart={moodDaypart}
            saving={moodSaving}
            error={moodError}
            onChangeName={setMoodName}
            onChangeValue={setMoodValue}
            onChangeNote={setMoodNote}
            onChangeDaypart={setMoodDaypart}
            onClose={() => setMoodOpen(false)}
            onSave={() => void saveMood()}
          />
        ) : null
      }
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen home-screen">
        <div className="welcome-row">
          <h1>Hola, {name || 'invitado'}</h1>
          <button className="text-link" type="button" onClick={openIntro}>
            Cómo empezar
          </button>
        </div>

        <section className="quick-mood card compact-checkin">
          <div className="quick-title">
            <div>
              <h2>¿Cómo estás ahora?</h2>
              <p>
                <Icon name="lock" /> Solo para ti
              </p>
            </div>
            <button className="text-link" type="button" onClick={() => openMood()}>
              Registrar
            </button>
          </div>
          <div className="mood-choices mood-choices-v2">
            {MOODS.map((mood) => (
              <button
                key={mood.name}
                className="mood-choice"
                type="button"
                onClick={() => openMood(mood.name)}
              >
                <span>{mood.emoji}</span>
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
                Comparte tu relato
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
          ) : null}
        </section>

        <div className="feed-tabs" role="tablist" aria-label="Vista del feed">
          <button
            type="button"
            role="tab"
            aria-selected={feedTab === 'for-you'}
            className={feedTab === 'for-you' ? 'active' : undefined}
            onClick={() => setFeedTab('for-you')}
          >
            Para ti
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={feedTab === 'following'}
            className={feedTab === 'following' ? 'active' : undefined}
            onClick={() => setFeedTab('following')}
          >
            Siguiendo
          </button>
        </div>

        {feedError ? (
          <div className="auth-error" role="alert">
            {feedError}
            <button className="text-link" type="button" onClick={() => void loadFeed()} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        ) : null}

        {feedLoading ? <p className="muted small">Preparando tu feed…</p> : null}

        <div id="feedList">
          {visibleFeed.length > 0
            ? visibleFeed.map((story, index) => renderCard(story, index, name))
            : null}

          {!feedLoading && !feedError && visibleFeed.length === 0 ? (
            <section className="empty-state">
              <h2>Aquí aparecerán sus relatos</h2>
              <p>Sigue a los autores que quieras volver a leer.</p>
              <button className="secondary" type="button" onClick={() => router.push('/explorar')}>
                Explorar relatos
              </button>
            </section>
          ) : null}
        </div>
      </section>
    </WyFrame>
  );
}
