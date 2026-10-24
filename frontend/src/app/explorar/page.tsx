'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';
import type { IconName } from '@/components/wy/icons';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import { fetchTaxonomy, type TaxonomyCatalog } from '@/lib/taxonomy';
import { listPublicStories, type FollowingStory } from '@/lib/stories';
import { searchCharacters, type CharacterSearchItem } from '@/lib/characters';
import { getFeaturedStories, type FeaturedStory } from '@/lib/discovery';
import { followCharacter, listFollowing, unfollowCharacter } from '@/lib/follows';

type SearchTab = 'all' | 'stories' | 'people' | 'categories';

const TABS: { key: SearchTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'stories', label: 'Relatos' },
  { key: 'people', label: 'Personas' },
  { key: 'categories', label: 'Categorías' },
];

const TOPIC_META: Record<string, { description: string; icon: IconName }> = {
  Ansiedad: { description: 'Cuando la mente no se detiene', icon: 'pulse' },
  Aprendizaje: { description: 'Lo que una experiencia te dejó', icon: 'book' },
  Autoestima: { description: 'Cómo te miras y te tratas', icon: 'user' },
  Cambio: { description: 'Nuevas etapas y decisiones', icon: 'trend' },
  Esperanza: { description: 'Relatos que miran hacia delante', icon: 'sparkle' },
  Familia: { description: 'Vínculos, crianza y convivencia', icon: 'home' },
  Gratitud: { description: 'Momentos que quieres guardar', icon: 'heart' },
  Pérdida: { description: 'Despedidas, duelos y nuevas etapas', icon: 'sparkle' },
  Relaciones: { description: 'Amor, amistad y vínculos', icon: 'users' },
  Salud: { description: 'Cuerpo, descanso y bienestar', icon: 'shield' },
  Soledad: { description: 'Días silenciosos y compañía', icon: 'users' },
  Trabajo: { description: 'Rutinas, esfuerzo y logros', icon: 'book' },
};

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

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function ExplorePage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [taxo, setTaxo] = useState<TaxonomyCatalog | null>(null);
  const [featured, setFeatured] = useState<FeaturedStory[]>([]);

  const [q, setQ] = useState('');
  const [selCat, setSelCat] = useState<string | null>(null);
  const [selEmo, setSelEmo] = useState<string | null>(null);
  const [tab, setTab] = useState<SearchTab>('all');

  const [stories, setStories] = useState<FollowingStory[]>([]);
  const [people, setPeople] = useState<CharacterSearchItem[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [busyAuthor, setBusyAuthor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftCat, setDraftCat] = useState('');
  const [draftEmo, setDraftEmo] = useState('');

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const term = q.trim();
  const searchMode = Boolean(term || selCat || selEmo);

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

    void fetchTaxonomy().then((result) => {
      if (result.status === 'ok') setTaxo(result.data);
    });

    void getFeaturedStories(6).then((result) => {
      if (result.status === 'ok') setFeatured(result.data.items);
    });

    void listFollowing().then((result) => {
      if (result.status === 'ok') {
        setFollowing(new Set(result.data.items.map((item) => item.name)));
      }
    });
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQ = params.get('q');
    const initialTab = params.get('tab');
    const category = params.get('category');
    const emotion = params.get('emotion');

    if (initialQ) setQ(initialQ);
    if (category) setSelCat(category);
    if (emotion) setSelEmo(emotion);
    if (initialTab === 'personajes') setTab('people');
    else if (initialTab === 'historias') setTab('stories');
  }, []);

  useEffect(() => {
    if (!searchMode) {
      setStories([]);
      setPeople([]);
      setBusy(false);
      setError('');
      return;
    }

    let active = true;
    setBusy(true);
    setError('');

    const timer = setTimeout(async () => {
      const [storyResult, peopleResult] = await Promise.all([
        listPublicStories({
          q: term || undefined,
          category: selCat ?? undefined,
          emotion: selEmo ?? undefined,
        }),
        term
          ? searchCharacters(term, 12)
          : Promise.resolve({
              status: 'ok' as const,
              data: { items: [] as CharacterSearchItem[] },
            }),
      ]);

      if (!active) return;
      setBusy(false);

      if (storyResult.status === 'ok') {
        setStories(storyResult.data.items);
      } else {
        setStories([]);
        setError(storyResult.message);
      }

      setPeople(peopleResult.status === 'ok' ? peopleResult.data.items : []);
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchMode, term, selCat, selEmo]);

  useEffect(() => {
    if (!searchMode) return;
    setTab(term ? 'all' : 'stories');
  }, [searchMode, term, selCat, selEmo]);

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
        router.push('/notificaciones');
        break;
      case 'help':
        router.push('/soporte');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const openFilters = () => {
    setDraftCat(selCat ?? '');
    setDraftEmo(selEmo ?? '');
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setSelCat(draftCat || null);
    setSelEmo(draftEmo || null);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setSelCat(null);
    setSelEmo(null);
    setDraftCat('');
    setDraftEmo('');
    setFiltersOpen(false);
  };

  const toggleFollow = async (name: string) => {
    const isFollowing = following.has(name);
    setBusyAuthor(name);
    const result = isFollowing ? await unfollowCharacter(name) : await followCharacter(name);
    setBusyAuthor(null);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setFollowing((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const openStory = (storyId: string) => {
    router.push(`/relato/${encodeURIComponent(storyId)}`);
  };

  const categories = taxo?.categories ?? [];
  const emotions = taxo?.emotions ?? [];
  const quickTopics = categories.filter((item) => item.name === 'Esperanza' || item.name === 'Aprendizaje');
  const categoryMatches = term
    ? [
        ...categories
          .filter((item) => normalizeSearch(item.name).includes(normalizeSearch(term)))
          .map((item) => ({ name: item.name, kind: 'category' as const })),
        ...emotions
          .filter((item) => normalizeSearch(item.name).includes(normalizeSearch(term)))
          .map((item) => ({ name: item.name, kind: 'emotion' as const })),
      ]
    : [];

  const activeFilters = [
    selCat ? { key: 'category' as const, label: selCat } : null,
    selEmo ? { key: 'emotion' as const, label: selEmo } : null,
  ].filter((item): item is { key: 'category' | 'emotion'; label: string } => item !== null);

  const renderStory = (story: FollowingStory) => (
    <article key={story.id} className="card story-row explore-story">
      <div>
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
              <span>{story.categories[0]}</span>
            </>
          ) : null}
        </p>
        {story.opening?.content ? <p className="post-text clamp">{story.opening.content}</p> : null}
      </div>
      <div className="story-row-actions">
        <button className="secondary" type="button" onClick={() => openStory(story.id)}>
          Leer relato
        </button>
      </div>
    </article>
  );

  const renderPerson = (person: CharacterSearchItem) => {
    const isSelf = person.name === character?.name;
    const isFollowing = following.has(person.name);
    return (
      <article key={person.name} className="card follow-row explore-person">
        <Avatar initials={initialsOf(person.name)} avatarUrl={person.avatarUrl} size="sm" />
        <div>
          <b>{person.name}</b>
          <small>@{person.name.toLowerCase()}</small>
          {person.tagline ? <small>{person.tagline}</small> : null}
        </div>
        {isSelf ? (
          <button className="text-link" type="button" onClick={() => router.push('/cuenta')}>
            Ver perfil
          </button>
        ) : (
          <button
            className={`secondary${isFollowing ? ' following' : ''}`}
            type="button"
            disabled={busyAuthor === person.name}
            onClick={() => void toggleFollow(person.name)}
          >
            {isFollowing ? 'Siguiendo' : 'Seguir autor'}
          </button>
        )}
      </article>
    );
  };

  const renderCategoryMatches = () =>
    categoryMatches.map((item) => {
      const active = item.kind === 'category' ? selCat === item.name : selEmo === item.name;
      return (
        <button
          key={`${item.kind}-${item.name}`}
          className={`filter-pill${active ? ' active' : ''}`}
          type="button"
          onClick={() => {
            if (item.kind === 'category') setSelCat(active ? null : item.name);
            else setSelEmo(active ? null : item.name);
          }}
        >
          {item.name}
        </button>
      );
    });

  const emptyResults = (
    <div className="empty-state">
      <h2>No encontramos coincidencias</h2>
      <p>Prueba con otra palabra o ajusta los filtros.</p>
      {activeFilters.length > 0 ? (
        <button className="secondary" type="button" onClick={clearFilters}>
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );

  const storyResults = stories.length > 0 ? stories.map(renderStory) : null;
  const personResults = people.length > 0 ? people.map(renderPerson) : null;
  const categoryResults = categoryMatches.length > 0 ? (
    <div className="filter-row">{renderCategoryMatches()}</div>
  ) : null;

  let results: ReactNode = null;
  if (tab === 'people') {
    results = personResults ?? emptyResults;
  } else if (tab === 'stories') {
    results = storyResults ?? emptyResults;
  } else if (tab === 'categories') {
    results = categoryResults ?? emptyResults;
  } else {
    results = (
      <>
        {personResults ? (
          <>
            <h2 className="search-section-title">Personas</h2>
            {personResults}
          </>
        ) : null}
        {categoryResults ? (
          <>
            <h2 className="search-section-title">Temas y emociones</h2>
            {categoryResults}
          </>
        ) : null}
        {storyResults ? (
          <>
            <h2 className="search-section-title">Relatos</h2>
            {storyResults}
          </>
        ) : null}
        {!personResults && !categoryResults && !storyResults ? emptyResults : null}
      </>
    );
  }

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
      activeRoute="explore"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      overlay={
        filtersOpen ? (
          <div className="modal discovery-filter-modal" role="dialog" aria-modal="true" aria-label="Filtrar relatos">
            <div className="modal-head">
              <div>
                <h2>Filtrar relatos</h2>
                <p>Ajusta el tema o la emoción para encontrar otros relatos.</p>
              </div>
              <button className="close" type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">
                <Icon name="x" />
              </button>
            </div>

            <div className="discovery-filter-fields">
              <div>
                <label htmlFor="filterTopic">Tema</label>
                <select id="filterTopic" value={draftCat} onChange={(event) => setDraftCat(event.target.value)}>
                  <option value="">Todos los temas</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filterEmotion">Emoción o estado</label>
                <select id="filterEmotion" value={draftEmo} onChange={(event) => setDraftEmo(event.target.value)}>
                  <option value="">Todas las emociones</option>
                  {emotions.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button className="ghost" type="button" onClick={clearFilters}>
                Quitar filtros
              </button>
              <button className="primary" type="button" onClick={applyFilters}>
                Aplicar filtros
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
          onDaily={() => notify('La consigna diaria llega con el próximo módulo.')}
          onCategory={(category) => {
            setSelCat(category);
            setSelEmo(null);
          }}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen explore-page">
        <div className="screen-heading">
          <div>
            <h1>{searchMode ? 'Buscar' : 'Explorar'}</h1>
            <p>
              {searchMode
                ? 'Encuentra relatos, emociones, categorías y personas por su seudónimo.'
                : 'Encuentra relatos por emoción, tema o seudónimo.'}
            </p>
          </div>
          <button className="secondary" type="button" onClick={openFilters}>
            <Icon name="settings" /> Filtros
          </button>
        </div>

        <label className="search-input">
          <Icon name="search" />
          <input
            type="search"
            value={q}
            placeholder="Relatos, emociones o seudónimos"
            aria-label="Buscar en Withyouly"
            onChange={(event) => setQ(event.target.value)}
          />
          <button className="ghost" type="button" onClick={() => setQ(q.trim())}>
            Buscar
          </button>
        </label>

        {activeFilters.length > 0 ? (
          <div className="active-discovery-filters" aria-label="Filtros aplicados">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                className="filter-pill active"
                type="button"
                aria-label={`Quitar filtro: ${filter.label}`}
                onClick={() => {
                  if (filter.key === 'category') setSelCat(null);
                  else setSelEmo(null);
                }}
              >
                {filter.label}
                <Icon name="x" />
              </button>
            ))}
            <button className="text-link" type="button" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        ) : null}

        {!searchMode ? (
          <>
            <div className="filter-row" role="group" aria-label="Descubrimiento">
              <button className={`filter-pill${!selCat && !selEmo ? ' active' : ''}`} type="button" onClick={clearFilters}>
                Recomendados
              </button>
              {quickTopics.map((item) => (
                <button
                  key={item.id}
                  className={`filter-pill${selCat === item.name ? ' active' : ''}`}
                  type="button"
                  onClick={() => setSelCat(item.name)}
                >
                  {item.name}
                </button>
              ))}
            </div>

            <h2 className="discovery-section-title">Explorar por tema</h2>
            <div className="category-grid">
              {categories.map((item) => {
                const meta = TOPIC_META[item.name] ?? {
                  description: 'Relatos sobre este tema',
                  icon: 'book' as IconName,
                };
                return (
                  <button
                    key={item.id}
                    className="category-tile"
                    type="button"
                    onClick={() => setSelCat(item.name)}
                  >
                    <span>
                      <Icon name={meta.icon} />
                    </span>
                    <b>{item.name}</b>
                    <small>{meta.description}</small>
                  </button>
                );
              })}
            </div>

            <section className="emotion-discovery">
              <h2 className="discovery-section-title">Explorar por emoción</h2>
              <div className="filter-row">
                {emotions.map((item) => (
                  <button
                    key={item.id}
                    className={`filter-pill${selEmo === item.name ? ' active' : ''}`}
                    type="button"
                    onClick={() => setSelEmo(item.name)}
                  >
                    <span
                      className="discovery-emotion-dot"
                      style={{ background: item.colorHex ?? '#9ba1b2' }}
                      aria-hidden
                    />
                    {item.name}
                  </button>
                ))}
              </div>
            </section>

            {featured.length > 0 ? (
              <>
                <h2 className="discovery-section-title">Relatos que podrían acompañarte</h2>
                <div className="story-list">{featured.slice(0, 3).map(renderStory)}</div>
              </>
            ) : null}
          </>
        ) : (
          <>
            <div className="filter-row search-result-tabs" role="tablist" aria-label="Tipo de resultado">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  className={`filter-pill${tab === item.key ? ' active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="search-result-query">
              {term ? `Resultados para “${term}”` : 'Relatos según tus filtros'}
              {tab === 'stories' ? ` · ${stories.length} ${stories.length === 1 ? 'relato' : 'relatos'}` : ''}
            </p>

            {busy ? <p className="muted small">Buscando…</p> : null}
            {error ? (
              <div className="auth-error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="search-results">{!busy && !error ? results : null}</div>
          </>
        )}
      </section>
    </WyFrame>
  );
}
