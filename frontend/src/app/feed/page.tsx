'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
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
import StoryForm from '@/components/wy/StoryForm';
import { followCharacter, listFollowing, unfollowCharacter } from '@/lib/follows';
import {
  listFollowingStories,
  listMyStories,
  listPublicStories,
  type FollowingStory,
  type MyStoryListItem,
} from '@/lib/stories';
import type { DemoStory } from '@/components/wy/feedData';

type FeedTab = 'for-you' | 'following';

interface FeedEntry extends DemoStory {
  isOwn: boolean;
  status?: 'DRAFT' | 'PUBLISHED';
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

function fromPublic(story: FollowingStory): FeedEntry {
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
    isOwn: false,
  };
}

function fromMine(story: MyStoryListItem, authorName: string): FeedEntry {
  return {
    id: story.id,
    author: authorName,
    initials: initialsOf(authorName),
    time: relativeTime(story.createdAt),
    category: story.categories[0] ?? 'Relato',
    updateKind: story.stageCount > 1 ? `Evolución · ${story.stageCount} etapas` : 'Relato',
    updateDate: relativeTime(story.updatedAt),
    updateText: '',
    title: story.title,
    text: story.opening?.content ?? '',
    support: story.supportCount,
    comments: story.commentCount,
    isOwn: true,
    status: story.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
  };
}

export default function FeedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState<CharacterSummary | null>(null);

  const [feedTab, setFeedTab] = useState<FeedTab>('for-you');
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState('');

  const [followedAuthors, setFollowedAuthors] = useState<Set<string>>(new Set());
  const [supported, setSupported] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [followStories, setFollowStories] = useState<Set<string>>(new Set());

  const [composerOpen, setComposerOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodName, setMoodName] = useState('Esperanza');
  const [moodValue, setMoodValue] = useState(7);
  const [moodDaypart, setMoodDaypart] = useState('Todo el día');

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);

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

  const loadFeed = useCallback(
    async (tab: FeedTab, authorName: string) => {
      setFeedLoading(true);
      setFeedError('');

      const [mine, published, following, follows] = await Promise.all([
        listMyStories(),
        listPublicStories(),
        tab === 'following' ? listFollowingStories() : Promise.resolve({ status: 'ok' as const, data: { items: [], nextCursor: null } }),
        listFollowing(),
      ]);

      if (follows.status === 'ok') {
        setFollowedAuthors(new Set(follows.data.items.map((item) => item.name)));
      }

      if (mine.status !== 'ok' || published.status !== 'ok') {
        setFeedError('No se pudo cargar el feed.');
        setEntries([]);
        setFeedLoading(false);
        return;
      }

      if (tab === 'following') {
        if (following.status !== 'ok') {
          setFeedError('No se pudo cargar tu feed de seguidos.');
          setEntries([]);
          setFeedLoading(false);
          return;
        }
        setEntries(following.data.items.map(fromPublic));
        setFeedLoading(false);
        return;
      }

      const own = mine.data.items.map((story) => fromMine(story, authorName));
      const ownIds = new Set(own.map((entry) => entry.id));
      const others = published.data.items
        .filter((story) => !ownIds.has(story.id))
        .map(fromPublic);

      // Mis relatos primero, luego el feed público.
      setEntries([...own, ...others]);
      setFeedLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (loading) return;
    void loadFeed(feedTab, character?.name ?? '');
  }, [feedTab, loading, character?.name, loadFeed]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const toggle = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    id: string,
    onMessage: string,
    offMessage: string,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        notify(offMessage);
      } else {
        next.add(id);
        notify(onMessage);
      }
      return next;
    });
  };

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

  const openPostMenu = (storyId: string) => {
    setSheet({
      title: 'Opciones del relato',
      rows: [
        { label: 'Seguir actualizaciones', icon: 'bell', onClick: () => toggle(setFollowStories, storyId, 'Seguirás las actualizaciones de este relato', 'Dejaste de seguir sus actualizaciones') },
        { label: 'Guardar relato', icon: 'bookmark', onClick: () => toggle(setSaved, storyId, 'Relato guardado', 'Relato eliminado de guardados') },
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
      case 'mood':
        openMood();
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'my-stories':
        setComposerOpen(true);
        break;
      case 'following':
        setFeedTab('following');
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

  const name = character?.name ?? '';
  const initials = initialsOf(character?.name);

  return (
    <WyFrame
      characterInitials={initials}
      avatarUrl={character?.avatarUrl}
      activeRoute="home"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      onSearch={() => notify('La búsqueda llega con el módulo de exploración.')}
      toast={toast}
      overlay={
        moodOpen ? (
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
                void loadFeed(feedTab, name);
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

        <div className="feed-tabs">
          <button
            type="button"
            className={feedTab === 'for-you' ? 'active' : undefined}
            onClick={() => setFeedTab('for-you')}
          >
            Para ti
          </button>
          <button
            type="button"
            className={feedTab === 'following' ? 'active' : undefined}
            onClick={() => setFeedTab('following')}
          >
            Siguiendo
          </button>
        </div>

        {feedError ? (
          <div className="auth-error" role="alert">
            {feedError}
            <button
              className="text-link"
              type="button"
              onClick={() => void loadFeed(feedTab, name)}
              style={{ marginLeft: 8 }}
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {feedLoading ? <p className="muted small">Cargando relatos…</p> : null}

        <div id="feedList">
          {!feedLoading && entries.length ? (
            entries.map((entry, index) => (
              <div key={entry.id} className="story-enter" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
                <PostCard
                  story={entry}
                  isOwn={entry.isOwn}
                  statusLabel={entry.status}
                  supported={supported.has(entry.id)}
                  saved={saved.has(entry.id)}
                  followingAuthor={followedAuthors.has(entry.author)}
                  followingStory={followStories.has(entry.id)}
                  onSupport={() => toggle(setSupported, entry.id, 'Tu apoyo fue enviado', 'Quitaste tu apoyo')}
                  onSave={() => toggle(setSaved, entry.id, 'Relato guardado', 'Relato eliminado de guardados')}
                  onFollowAuthor={() => void toggleFollowAuthor(entry.author)}
                  onFollowStory={() =>
                    toggle(setFollowStories, entry.id, 'Recibirás futuras actualizaciones de este relato', 'Dejaste de seguir sus actualizaciones')
                  }
                  onOpenMenu={() => openPostMenu(entry.id)}
                  onPlay={() => notify('Reproduciendo vista previa')}
                  onAuthor={() => router.push(`/personaje/${encodeURIComponent(entry.author)}`)}
                  onComment={() => notify('Los comentarios llegan con el módulo de acompañamiento.')}
                />
              </div>
            ))
          ) : null}

          {!feedLoading && !feedError && entries.length === 0 ? (
            <div className="empty card">
              <div className="empty-icon">
                <Icon name="book" />
              </div>
              <h2>{feedTab === 'following' ? 'Aún no sigues a nadie' : 'Todavía no hay relatos'}</h2>
              <p>
                {feedTab === 'following'
                  ? 'Explora autores con los que conectes. Aquí aparecerán sus nuevos relatos.'
                  : 'Sé la primera persona en compartir. Tu relato aparecerá aquí.'}
              </p>
              <button
                className="primary"
                type="button"
                style={{ padding: '12px 18px' }}
                onClick={() => (feedTab === 'following' ? setFeedTab('for-you') : setComposerOpen(true))}
              >
                {feedTab === 'following' ? 'Explorar el feed' : 'Compartir un relato'}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </WyFrame>
  );
}
