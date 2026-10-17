'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import Icon from '@/components/wy/Icon';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import StoryViewer from '@/components/wy/StoryViewer';
import { fetchTaxonomy, type TaxonomyCatalog } from '@/lib/taxonomy';
import { listPublicStories, viewStory, type FollowingStory, type MyStory } from '@/lib/stories';
import { searchCharacters, type CharacterSearchItem } from '@/lib/characters';
import {
  getFeaturedStories,
  getRecommendedCharacters,
  getTrendingStories,
  type FeaturedStory,
  type RecommendedCharacter,
  type TrendStory,
} from '@/lib/discovery';
import { unreadNotificationsCount } from '@/lib/notifications';
import NotificationsPanel from '@/components/wy/NotificationsPanel';
import Avatar from '@/components/wy/Avatar';
import { CATEGORY_EMOJI, EMOTION_EMOJI } from '@/components/wy/StoryTaxonomyFields';

type Tab = 'historias' | 'personajes';

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

/** «3 📖 · 5 👥» en vez de «3 relatos · 5 seguidores». */
function PersonStats({ stories, followers }: { stories: number; followers: number }) {
  return (
    <span className="explore-stats">
      <span>{stories} 📖</span>
      <span>{followers} 👥</span>
    </span>
  );
}

export default function ExplorePage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>('historias');
  const [q, setQ] = useState('');
  const [taxo, setTaxo] = useState<TaxonomyCatalog | null>(null);
  const [selCat, setSelCat] = useState<string | null>(null);
  const [selEmo, setSelEmo] = useState<string | null>(null);
  const [selTag, setSelTag] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(false);

  const [stories, setStories] = useState<FollowingStory[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [people, setPeople] = useState<CharacterSearchItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [view, setView] = useState<MyStory | null>(null);
  const [viewBusy, setViewBusy] = useState(false);

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [featured, setFeatured] = useState<FeaturedStory[]>([]);
  const [trends, setTrends] = useState<TrendStory[]>([]);
  const [recommended, setRecommended] = useState<RecommendedCharacter[]>([]);
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
        if (res.ok) setCharacter(await res.json());
      } catch (error) {
        console.error('Error verificando sesión', error);
      } finally {
        setLoading(false);
      }
    };

    void verify();
    void fetchTaxonomy().then((result) => {
      if (result.status === 'ok') setTaxo(result.data);
    });

    void Promise.all([
      getFeaturedStories(),
      getTrendingStories(),
      getRecommendedCharacters(),
      unreadNotificationsCount(),
    ]).then(([featuredResult, trendsResult, recommendedResult, unread]) => {
      if (featuredResult.status === 'ok') setFeatured(featuredResult.data.items);
      if (trendsResult.status === 'ok') setTrends(trendsResult.data.items);
      if (recommendedResult.status === 'ok') setRecommended(recommendedResult.data.items);
      if (unread.status === 'ok') setUnreadCount(unread.data.count);
    });
  }, [router]);

  // La búsqueda del encabezado llega aquí como parámetros de la URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQ = params.get('q');
    const initialTab = params.get('tab');
    const category = params.get('category');
    const emotion = params.get('emotion');
    const tag = params.get('tag');

    if (initialQ) setQ(initialQ);
    if (category) setSelCat(category);
    if (emotion) setSelEmo(emotion);
    if (tag) setSelTag(tag);
    if (initialTab === 'personajes' || initialTab === 'historias') setTab(initialTab);
  }, []);

  const run = useCallback(async (cursor?: string) => {
    setBusy(true);
    setError('');

    if (tab === 'personajes') {
      const result = await searchCharacters(q);
      setBusy(false);
      if (result.status === 'ok') setPeople(result.data.items);
      else setError(result.message);
      return;
    }

    const result = await listPublicStories({
      q: q.trim() || undefined,
      category: selCat ?? undefined,
      emotion: selEmo ?? undefined,
      tag: selTag ?? undefined,
      cursor,
    });
    setBusy(false);

    if (result.status === 'ok') {
      setStories((prev) => (cursor ? [...prev, ...result.data.items] : result.data.items));
      setNextCursor(result.data.nextCursor);
    } else {
      setError(result.message);
      setStories([]);
    }
  }, [tab, q, selCat, selEmo, selTag]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStories([]);
      setNextCursor(null);
      void run();
    }, 200);
    return () => clearTimeout(timer);
  }, [run]);

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
      case 'following':
        router.push('/siguiendo');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'explore':
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
      case 'help':
        notify('Ayuda, privacidad y recursos de apoyo llegarán pronto.');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
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

  const hasFilters = Boolean(selCat || selEmo || selTag);

  const renderFeatured = (items: FeaturedStory[]) => {
    if (items.length === 0) return null;
    return (
      <div className="feed-group">
        <h2 className="feed-group-title">✨ Destacado</h2>
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
                    <span>
                      {CATEGORY_EMOJI[story.categories[0]] ?? '🏷️'} {story.categories[0]}
                    </span>
                  </>
                ) : null}
              </p>
              {story.opening?.content ? <p className="post-text clamp">{story.opening.content}</p> : null}
              {story.opening?.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={story.opening.mediaUrl} alt="" className="post-media" />
              ) : null}
              <div className="story-row-actions">
                <button className="action-link" type="button" onClick={() => void openStory(story.id)}>
                  <Icon name="book" /> Leer
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  };

  const renderTrends = (items: TrendStory[]) => {
    if (items.length === 0) return null;
    return (
      <div className="feed-group" style={{ marginTop: 16 }}>
        <h2 className="feed-group-title">🔥 Tendencias</h2>
        <div className="stack">
          {items.slice(0, 6).map((story) => (
            <article key={story.id} className="card story-row">
              <div className="story-row-head">
                <h2>{story.title}</h2>
                <span className="status-pill featured">🔥 {story.trendScore}</span>
              </div>
              <p className="story-row-meta">
                <Icon name="user" />
                <span>{story.author.name}</span>
                {story.categories[0] ? (
                  <>
                    <span className="dot" aria-hidden />
                    <span>
                      {CATEGORY_EMOJI[story.categories[0]] ?? '🏷️'} {story.categories[0]}
                    </span>
                  </>
                ) : null}
              </p>
              {story.opening?.content ? <p className="post-text clamp">{story.opening.content}</p> : null}
              <div className="story-row-actions">
                <button className="action-link" type="button" onClick={() => void openStory(story.id)}>
                  <Icon name="book" /> Leer
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  };

  const renderRecommended = (items: RecommendedCharacter[]) => {
    if (items.length === 0) return null;
    return (
      <div className="feed-group" style={{ marginTop: 16 }}>
        <h2 className="feed-group-title">🌟 Personajes</h2>
        <div className="stack">
          {items.map((person) => (
            <button
              key={person.name}
              type="button"
              className="card pad recommend-person"
              onClick={() => router.push(`/personaje/${encodeURIComponent(person.name)}`)}
            >
              <div className="recommend-row">
                <Avatar initials={initialsOf(person.name)} avatarUrl={person.avatarUrl} size="sm" />
                <div style={{ minWidth: 0 }}>
                  <b>{person.name}</b>
                  {person.tagline ? <p className="hint" style={{ margin: 0 }}>{person.tagline}</p> : null}
                </div>
              </div>
              <div className="recommend-meta">
                {person.sharedInterests > 0 ? (
                  <span className="chip on">✨ {person.sharedInterests} en común</span>
                ) : null}
                <PersonStats stories={person.stories} followers={person.followers} />
              </div>
            </button>
          ))}
        </div>
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

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="explore"
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
              void openStory(storyId);
            }}
            onOpenCharacter={(name) => {
              setNotificationsOpen(false);
              router.push(`/personaje/${encodeURIComponent(name)}`);
            }}
          />
        ) : view ? (
          <StoryViewer story={view} onNotify={notify} onClose={() => setView(null)} />
        ) : null
      }
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onDaily={() => notify('La consigna diaria llega con el módulo de historias.')}
          onCategory={(category) => {
            setSelCat(category);
            setTab('historias');
          }}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen explore-page">
        <div className="welcome-row">
          <div>
            <h1>Explorar</h1>
            <p className="muted small">
              {name ? `${name}, encuentra historias y personas afines.` : 'Descubre contenido para ti.'}
            </p>
          </div>
        </div>

        <div className="search-row">
          <Icon name="search" />
          <input
            type="search"
            value={q}
            placeholder={tab === 'personajes' ? 'Buscar seudónimos…' : 'Buscar historias, emociones o etiquetas…'}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>

        <div className="segmented" role="tablist" aria-label="Tipo de búsqueda">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'historias'}
            className={tab === 'historias' ? 'active' : undefined}
            onClick={() => setTab('historias')}
          >
            📖 Historias
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'personajes'}
            className={tab === 'personajes' ? 'active' : undefined}
            onClick={() => setTab('personajes')}
          >
            👤 Personajes
          </button>
        </div>

        {tab === 'historias' && taxo ? (
          <div className="card explore-filters">
            <div className="explore-filter-head">
              <span className="explore-filter-title">Filtros</span>
              {hasFilters ? (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setSelCat(null);
                    setSelEmo(null);
                    setSelTag(null);
                  }}
                >
                  Limpiar
                </button>
              ) : null}
            </div>

            {taxo.categories.length > 0 ? (
              <div className="opt-block">
                <span className="opt-label">🏷️ Categoría</span>
                <div className="emoji-chips" role="group" aria-label="Categoría">
                  {taxo.categories.map((item) => {
                    const on = selCat === item.name;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`emoji-chip${on ? ' on' : ''}`}
                        aria-pressed={on}
                        onClick={() => setSelCat(on ? null : item.name)}
                      >
                        <span className="emoji-chip-ico" aria-hidden>
                          {CATEGORY_EMOJI[item.name] ?? '🏷️'}
                        </span>
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {taxo.emotions.length > 0 ? (
              <div className="opt-block">
                <span className="opt-label">💗 Emoción</span>
                <div className="emoji-chips" role="group" aria-label="Emoción">
                  {taxo.emotions.map((item) => {
                    const on = selEmo === item.name;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`emoji-chip${on ? ' on' : ''}`}
                        style={on && item.colorHex ? ({ '--c': item.colorHex } as CSSProperties) : undefined}
                        aria-pressed={on}
                        onClick={() => setSelEmo(on ? null : item.name)}
                      >
                        <span className="emoji-chip-ico" aria-hidden>
                          {EMOTION_EMOJI[item.name] ?? '💗'}
                        </span>
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {taxo.tags.length > 0 ? (
              <div className="opt-block">
                <button
                  type="button"
                  className="opt-collapse"
                  aria-expanded={showTags}
                  onClick={() => setShowTags((value) => !value)}
                >
                  <span className="opt-collapse-label">🎯 Etiquetas</span>
                  {selTag ? <span className="opt-count">1</span> : null}
                  <Icon name="chevron" className={`opt-chevron${showTags ? ' open' : ''}`} />
                </button>

                {!showTags && selTag ? (
                  <div className="mini-tags">
                    <span className="mini-tag">{selTag}</span>
                  </div>
                ) : null}

                {showTags ? (
                  <div className="chip-row" style={{ marginTop: 10 }} role="group" aria-label="Etiqueta">
                    {taxo.tags.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`chip${selTag === item.name ? ' on' : ''}`}
                        aria-pressed={selTag === item.name}
                        onClick={() => setSelTag(selTag === item.name ? null : item.name)}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {busy ? <p className="muted small">Buscando…</p> : null}

        {!q && !hasFilters ? (
          <>
            {renderFeatured(featured)}
            {renderTrends(trends)}
            {renderRecommended(recommended)}
          </>
        ) : null}

        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}

        {!busy && !error && tab === 'personajes' ? (
          people.length > 0 ? (
            <div className="stack">
              {people.map((person) => (
                <button
                  key={person.name}
                  type="button"
                  className="card pad explore-person"
                  onClick={() => router.push(`/personaje/${encodeURIComponent(person.name)}`)}
                >
                  <div className="row-between">
                    <div style={{ minWidth: 0 }}>
                      <b>{person.name}</b>
                      {person.tagline ? <p className="hint" style={{ margin: 0 }}>{person.tagline}</p> : null}
                    </div>
                    <PersonStats stories={person.stories} followers={person.followers} />
                  </div>
                </button>
              ))}
            </div>
          ) : !q && !busy ? (
            <div className="empty card">
              <div className="empty-icon"><Icon name="users" /></div>
              <h2>Busca a alguien</h2>
              <p>Escribe un seudónimo para encontrar personas con las que conectar.</p>
            </div>
          ) : (
            <div className="empty card">
              <div className="empty-icon"><Icon name="search" /></div>
              <h2>Sin resultados</h2>
              <p>Prueba con otro nombre.</p>
            </div>
          )
        ) : null}

        {!busy && !error && tab === 'historias' ? (
          stories.length > 0 ? (
            <div className="story-list">
              {stories.map((story) => (
                <article key={story.id} className="card story-row">
                  <div className="story-row-head">
                    <h2>{story.title}</h2>
                    <span className="hint">{relativeTime(story.createdAt)}</span>
                  </div>
                  <p className="story-row-meta">
                    <Icon name="user" />
                    <span>{story.author.name}</span>
                    {story.categories[0] ? (
                      <>
                        <span className="dot" aria-hidden />
                        <span>
                          {CATEGORY_EMOJI[story.categories[0]] ?? '🏷️'} {story.categories[0]}
                        </span>
                      </>
                    ) : null}
                  </p>
                  {story.opening?.content ? <p className="post-text clamp">{story.opening.content}</p> : null}
                  <div className="story-row-actions">
                    <button
                      className="action-link"
                      type="button"
                      disabled={viewBusy}
                      onClick={() => void openStory(story.id)}
                    >
                      <Icon name="book" /> Leer
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty card">
              <div className="empty-icon"><Icon name="book" /></div>
              <h2>Sin historias</h2>
              <p>Prueba con otro texto o cambia los filtros de emoción, categoría y etiqueta.</p>
            </div>
          )
        ) : null}

        {nextCursor ? (
          <button className="btn-outline" type="button" onClick={() => void run(nextCursor)}>
            Ver más
          </button>
        ) : null}
      </section>
    </WyFrame>
  );
}
