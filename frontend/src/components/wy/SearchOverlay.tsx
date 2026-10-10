'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import Avatar from './Avatar';
import CommentSection from './CommentSection';
import { fetchTaxonomy, type TaxonomyCatalog } from '@/lib/taxonomy';
import { listPublicStories, viewStory, type FollowingStory, type MyStory } from '@/lib/stories';
import { searchCharacters, type CharacterSearchItem } from '@/lib/characters';

type Tab = 'historias' | 'personajes';

interface FilterOption {
  id: string;
  name: string;
  colorHex?: string | null;
}

interface Props {
  onClose: () => void;
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

function FilterGroup({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: FilterOption[];
  selected: string | null;
  onToggle: (name: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="search-filter-group">
      <p className="search-filter-label">{label}</p>
      <div className="chip-row">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip ${selected === item.name ? 'on' : ''}`}
            aria-pressed={selected === item.name}
            onClick={() => onToggle(item.name)}
          >
            {item.colorHex ? (
              <span className="chip-dot" style={{ background: item.colorHex }} aria-hidden />
            ) : null}
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SearchOverlay({ onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>('historias');
  const [q, setQ] = useState('');
  const [taxo, setTaxo] = useState<TaxonomyCatalog | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selCat, setSelCat] = useState<string | null>(null);
  const [selEmo, setSelEmo] = useState<string | null>(null);
  const [selTag, setSelTag] = useState<string | null>(null);

  const [stories, setStories] = useState<FollowingStory[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [people, setPeople] = useState<CharacterSearchItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [detail, setDetail] = useState<MyStory | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    void fetchTaxonomy().then((result) => {
      if (active && result.status === 'ok') setTaxo(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const run = useCallback(
    async (cursor?: string) => {
      const term = q.trim();

      if (tab === 'personajes') {
        if (!term) {
          setPeople([]);
          setError('');
          setBusy(false);
          return;
        }
        setBusy(true);
        setError('');
        const result = await searchCharacters(term);
        setBusy(false);
        if (result.status === 'ok') {
          setPeople(result.data.items);
        } else {
          setError(result.message);
          setPeople([]);
        }
        return;
      }

      const hasFilter = Boolean(selCat || selEmo || selTag);
      if (!term && !hasFilter) {
        setStories([]);
        setNextCursor(null);
        setError('');
        setBusy(false);
        return;
      }

      setBusy(true);
      setError('');
      const result = await listPublicStories({
        q: term || undefined,
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
        if (!cursor) setStories([]);
      }
    },
    [q, tab, selCat, selEmo, selTag],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void run();
    }, 220);
    return () => clearTimeout(timer);
  }, [run]);

  const openDetail = async (storyId: string) => {
    setDetailBusy(true);
    const result = await viewStory(storyId);
    setDetailBusy(false);
    if (result.status === 'ok') {
      setDetail(result.data);
      return;
    }
    setError(result.message);
  };

  const goToCharacter = (name: string) => {
    onClose();
    router.push(`/personaje/${encodeURIComponent(name)}`);
  };

  const activeFilters = useMemo(() => {
    const list: { label: string; clear: () => void }[] = [];
    if (selCat) list.push({ label: `Categoría: ${selCat}`, clear: () => setSelCat(null) });
    if (selEmo) list.push({ label: `Emoción: ${selEmo}`, clear: () => setSelEmo(null) });
    if (selTag) list.push({ label: `Etiqueta: ${selTag}`, clear: () => setSelTag(null) });
    return list;
  }, [selCat, selEmo, selTag]);

  const clearAll = () => {
    setSelCat(null);
    setSelEmo(null);
    setSelTag(null);
  };

  const toggle =
    (setter: Dispatch<SetStateAction<string | null>>) => (name: string) =>
      setter((current) => (current === name ? null : name));

  const hasQuery = q.trim().length > 0;

  const renderStories = () => {
    if (busy && stories.length === 0) return <p className="hint search-status">Buscando…</p>;
    if (stories.length === 0) {
      if (error) {
        return (
          <div className="auth-error" role="alert">
            {error}
          </div>
        );
      }
      const started = hasQuery || activeFilters.length > 0;
      return (
        <div className="search-empty">
          <span className="search-empty-icon">
            <Icon name={started ? 'search' : 'book'} />
          </span>
          <h3>{started ? 'Sin relatos' : 'Busca relatos'}</h3>
          <p>
            {started
              ? 'Prueba con otro texto o ajusta los filtros de categoría, emoción y etiqueta.'
              : 'Escribe una palabra o elige una categoría, emoción o etiqueta para empezar.'}
          </p>
        </div>
      );
    }
    return (
      <>
        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="search-list">
          {stories.map((story) => (
            <button
              key={story.id}
              type="button"
              className="search-result"
              disabled={detailBusy}
              onClick={() => void openDetail(story.id)}
            >
              <span className="search-result-title">{story.title}</span>
              <span className="search-result-meta">
                <span className="search-result-author">
                  <Icon name="user" />
                  {story.author.name}
                </span>
                {story.categories[0] ? (
                  <span className="search-result-cat">{story.categories[0]}</span>
                ) : null}
                <span className="search-result-time">{relativeTime(story.createdAt)}</span>
              </span>
              {story.opening?.content ? (
                <span className="search-result-snippet">{story.opening.content}</span>
              ) : null}
            </button>
          ))}
        </div>
        {nextCursor ? (
          <button
            className="btn-outline search-more"
            type="button"
            disabled={busy}
            onClick={() => void run(nextCursor)}
          >
            {busy ? 'Cargando…' : 'Ver más'}
          </button>
        ) : null}
      </>
    );
  };

  const renderPeople = () => {
    if (!hasQuery) {
      return (
        <div className="search-empty">
          <span className="search-empty-icon">
            <Icon name="users" />
          </span>
          <h3>Busca a alguien</h3>
          <p>Escribe un seudónimo para encontrar personas con las que conectar.</p>
        </div>
      );
    }
    if (busy && people.length === 0) return <p className="hint search-status">Buscando…</p>;
    if (error && people.length === 0) {
      return (
        <div className="auth-error" role="alert">
          {error}
        </div>
      );
    }
    if (people.length === 0) {
      return (
        <div className="search-empty">
          <span className="search-empty-icon">
            <Icon name="search" />
          </span>
          <h3>Sin resultados</h3>
          <p>No encontramos personajes con ese seudónimo. Prueba con otro nombre.</p>
        </div>
      );
    }
    return (
      <div className="search-list">
        {people.map((person) => (
          <button
            key={person.name}
            type="button"
            className="search-result search-result-person"
            onClick={() => goToCharacter(person.name)}
          >
            <Avatar initials={initialsOf(person.name)} avatarUrl={person.avatarUrl} size="sm" />
            <span className="search-result-main">
              <span className="search-result-title">{person.name}</span>
              {person.tagline ? <span className="search-result-snippet">{person.tagline}</span> : null}
            </span>
            <span className="search-result-stats">
              {person.stories} {person.stories === 1 ? 'relato' : 'relatos'} · {person.followers}{' '}
              {person.followers === 1 ? 'seguidor' : 'seguidores'}
            </span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Buscar" onClick={onClose}>
      <div className="search-panel" onClick={(event) => event.stopPropagation()}>
        <div className="search-panel-head">
          <div className="search-field">
            <Icon name="search" />
            <input
              ref={inputRef}
              type="search"
              value={q}
              placeholder={
                tab === 'personajes'
                  ? 'Buscar seudónimos…'
                  : 'Buscar relatos, emociones o etiquetas…'
              }
              aria-label="Buscar"
              onChange={(event) => setQ(event.target.value)}
            />
            {q ? (
              <button
                className="search-clear"
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setQ('')}
              >
                <Icon name="x" />
              </button>
            ) : null}
          </div>
          <button className="search-close" type="button" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" />
          </button>
        </div>

        {detail ? (
          <div className="search-detail">
            <div className="search-detail-head">
              <button className="action-link" type="button" onClick={() => setDetail(null)}>
                <Icon name="chevron" /> Volver a resultados
              </button>
              <span className="hint">
                {detail.author ? `${detail.author.name} · ` : ''}
                {detail.updates.length} {detail.updates.length === 1 ? 'etapa' : 'etapas'}
              </span>
            </div>
            <h2 className="search-detail-title">{detail.title}</h2>
            <div className="stage-list">
              {detail.updates.map((stage) => (
                <div key={stage.id} className="stage-item">
                  <div className="stage-head">
                    <span>Etapa {stage.stageOrder}</span>
                    <span>{relativeTime(stage.createdAt)}</span>
                  </div>
                  {stage.content ? <p>{stage.content}</p> : null}
                  {stage.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={stage.mediaUrl} alt="" className="post-media" />
                  ) : null}
                  {stage.audioUrl ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio controls src={stage.audioUrl} className="post-audio" />
                  ) : null}
                </div>
              ))}
            </div>
            <CommentSection storyId={detail.id} />
          </div>
        ) : (
          <>
            <div className="search-toolbar">
              <div className="segmented search-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'historias'}
                  className={tab === 'historias' ? 'active' : undefined}
                  onClick={() => setTab('historias')}
                >
                  Historias
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'personajes'}
                  className={tab === 'personajes' ? 'active' : undefined}
                  onClick={() => setTab('personajes')}
                >
                  Personajes
                </button>
              </div>
              {tab === 'historias' && taxo ? (
                <button
                  type="button"
                  className="search-filters-toggle"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((value) => !value)}
                >
                  Filtros
                  {activeFilters.length > 0 ? (
                    <span className="search-filters-count">{activeFilters.length}</span>
                  ) : null}
                </button>
              ) : null}
            </div>

            {tab === 'historias' && taxo && filtersOpen ? (
              <div className="search-filters">
                <FilterGroup
                  label="Categoría"
                  items={taxo.categories}
                  selected={selCat}
                  onToggle={toggle(setSelCat)}
                />
                <FilterGroup
                  label="Emoción"
                  items={taxo.emotions}
                  selected={selEmo}
                  onToggle={toggle(setSelEmo)}
                />
                <FilterGroup
                  label="Etiqueta"
                  items={taxo.tags}
                  selected={selTag}
                  onToggle={toggle(setSelTag)}
                />
              </div>
            ) : null}

            {tab === 'historias' && activeFilters.length > 0 ? (
              <div className="search-active-filters">
                <span className="hint">Filtros activos</span>
                {activeFilters.map((filter) => (
                  <button
                    key={filter.label}
                    type="button"
                    className="search-active-chip"
                    onClick={filter.clear}
                  >
                    {filter.label}
                    <Icon name="x" />
                  </button>
                ))}
                <button type="button" className="text-link" onClick={clearAll}>
                  Limpiar
                </button>
              </div>
            ) : null}

            <div className="search-results">
              {tab === 'historias' ? renderStories() : renderPeople()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
