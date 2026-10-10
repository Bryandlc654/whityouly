'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import Icon from '@/components/wy/Icon';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import CommentSection from '@/components/wy/CommentSection';
import { fetchTaxonomy, type TaxonomyCatalog } from '@/lib/taxonomy';
import { listPublicStories, viewStory, type FollowingStory, type MyStory } from '@/lib/stories';
import { searchCharacters, type CharacterSearchItem } from '@/lib/characters';

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
  }, [router]);

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
        notify('Mi estado emocional llega con el módulo del diario.');
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
      onSearch={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
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
                  {stage.content ? <p>{stage.content}</p> : null}
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

            <CommentSection storyId={view.id} onNotify={notify} />

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
          onCategory={(category) => {
            setSelCat(category);
            setTab('historias');
          }}
          onMood={() => notify('Mi estado emocional llega con el módulo del diario.')}
        />
      }
    >
      <section className="screen">
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

        <div className="segmented">
          <button type="button" className={tab === 'historias' ? 'active' : undefined} onClick={() => setTab('historias')}>
            Historias
          </button>
          <button type="button" className={tab === 'personajes' ? 'active' : undefined} onClick={() => setTab('personajes')}>
            Personajes
          </button>
        </div>

        {tab === 'historias' && taxo ? (
          <>
            {taxo.categories.length > 0 ? (
              <div>
                <p className="hint" style={{ margin: '6px 0 4px' }}>Categoría</p>
                <div className="chip-row">
                  {taxo.categories.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`chip ${selCat === item.name ? 'on' : ''}`}
                      onClick={() => setSelCat(selCat === item.name ? null : item.name)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {taxo.emotions.length > 0 ? (
              <div>
                <p className="hint" style={{ margin: '6px 0 4px' }}>Emoción</p>
                <div className="chip-row">
                  {taxo.emotions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`chip ${selEmo === item.name ? 'on' : ''}`}
                      onClick={() => setSelEmo(selEmo === item.name ? null : item.name)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {taxo.tags.length > 0 ? (
              <div>
                <p className="hint" style={{ margin: '6px 0 4px' }}>Etiqueta</p>
                <div className="chip-row">
                  {taxo.tags.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`chip ${selTag === item.name ? 'on' : ''}`}
                      onClick={() => setSelTag(selTag === item.name ? null : item.name)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {busy ? <p className="muted small">Buscando…</p> : null}

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
                    <span className="hint">
                      {person.stories} {person.stories === 1 ? 'relato' : 'relatos'} · {person.followers}{' '}
                      {person.followers === 1 ? 'seguidor' : 'seguidores'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            !q && !busy ? (
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
                        <span>{story.categories[0]}</span>
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
                      <Icon name="book" /> Leer historia
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