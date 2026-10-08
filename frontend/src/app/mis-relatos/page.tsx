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
import StoryComposer from '@/components/wy/StoryComposer';
import StoryMetaModal, { type EditableStory } from '@/components/wy/StoryMetaModal';
import StoryDetailModal from '@/components/wy/StoryDetailModal';
import {
  deleteStory,
  getMyStory,
  listMyStories,
  publishStory,
  unpublishStory,
  type MyStory,
  type MyStoryListItem,
} from '@/lib/stories';

type StatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'DRAFT', label: 'Borradores' },
  { id: 'PUBLISHED', label: 'Publicados' },
];

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default function MyStoriesPage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [stories, setStories] = useState<MyStoryListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const [busyId, setBusyId] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [metaStory, setMetaStory] = useState<EditableStory | null>(null);
  const [detail, setDetail] = useState<MyStory | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

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

  const loadStories = useCallback(async (status: StatusFilter, cursor?: string) => {
    if (!cursor) setListError('');
    const result = await listMyStories({
      status: status === 'ALL' ? undefined : status,
      cursor,
    });

    if (result.status !== 'ok') {
      setListError(result.message);
      if (!cursor) setStories([]);
      return;
    }

    setStories((prev) => (cursor ? [...prev, ...result.data.items] : result.data.items));
    setNextCursor(result.data.nextCursor);
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
    if (!loading) void loadStories(filter);
  }, [filter, loading, loadStories]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Ir al Feed', icon: 'home', onClick: () => router.push('/feed') },
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
        setComposerOpen(true);
        break;
      case 'mood':
        notify('Mi estado emocional llega con el módulo del diario.');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const handleCreated = () => {
    setComposerOpen(false);
    notify('Tu relato se guardó.');
    void loadStories(filter);
  };

  const toggleStatus = async (story: MyStoryListItem) => {
    setBusyId(story.id);
    const result = story.status === 'PUBLISHED' ? await unpublishStory(story.id) : await publishStory(story.id);
    setBusyId(null);

    if (result.status === 'ok') {
      notify(story.status === 'PUBLISHED' ? 'Relato vuelto a borrador.' : 'Relato publicado.');
      void loadStories(filter);
      return;
    }
    notify(result.message);
  };

  const remove = async (story: MyStoryListItem) => {
    setBusyId(story.id);
    const result = await deleteStory(story.id);
    setBusyId(null);

    if (result.status === 'ok') {
      setStories((prev) => prev.filter((item) => item.id !== story.id));
      notify('Relato dado de baja.');
      return;
    }
    notify(result.message);
  };

  const openDetail = async (story: MyStoryListItem) => {
    setDetailBusy(true);
    const result = await getMyStory(story.id);
    setDetailBusy(false);

    if (result.status === 'ok') {
      setDetail(result.data);
      return;
    }
    notify(result.message);
  };

  const handleMetaSaved = () => {
    setMetaStory(null);
    notify('Cambios guardados.');
    void loadStories(filter);
  };

  const name = character?.name ?? '';

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="my-stories"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      onSearch={() => notify('La búsqueda llega con el módulo de exploración.')}
      toast={toast}
      overlay={
        composerOpen ? (
          <StoryComposer onClose={() => setComposerOpen(false)} onCreated={handleCreated} />
        ) : metaStory ? (
          <StoryMetaModal story={metaStory} onClose={() => setMetaStory(null)} onSaved={handleMetaSaved} />
        ) : detail ? (
          <StoryDetailModal
            story={detail}
            onClose={() => setDetail(null)}
            onChanged={() => void loadStories(filter)}
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
          onMood={() => notify('Mi estado emocional llega con el módulo del diario.')}
        />
      }
    >
      <section className="screen">
        <div className="welcome-row">
          <div>
            <h1>Mis relatos</h1>
            <p className="muted small">
              {name
                ? `${name}, este es tu espacio para escribir y volver cuando quieras.`
                : 'Tus historias y su evolución.'}
            </p>
          </div>
          <button className="secondary" type="button" onClick={() => setComposerOpen(true)}>
            <Icon name="plus" />
            Compartir relato
          </button>
        </div>

        <div className="segmented">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? 'active' : undefined}
              aria-current={filter === item.id ? 'page' : undefined}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? <p className="muted small">Verificando acceso…</p> : null}

        {!loading && listError ? (
          <div className="auth-error" role="alert">
            {listError}
            <button
              className="text-link"
              type="button"
              onClick={() => void loadStories(filter)}
              style={{ marginLeft: 8 }}
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {!loading && !listError && stories.length === 0 ? (
          <div className="empty card">
            <div className="empty-icon">
              <Icon name="book" />
            </div>
            <h2>Todavía no has escrito</h2>
            <p>Comparte lo que necesitas sacar de tu pecho. Puedes guardarlo en privado y decidir después.</p>
            <button
              className="primary"
              type="button"
              style={{ padding: '12px 18px' }}
              onClick={() => setComposerOpen(true)}
            >
              Escribir mi primer relato
            </button>
          </div>
        ) : null}

        <div className="stack">
          {stories.map((story) => (
            <article key={story.id} className="post card story-card">
              <div className="post-tags" style={{ margin: 0 }}>
                <span className="tag update">{story.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}</span>
                <span className="tag">
                  {story.visibility === 'PUBLIC'
                    ? 'Público'
                    : story.visibility === 'FOLLOWERS'
                      ? 'Seguidores'
                      : 'Privado'}
                </span>
                {story.categories.slice(0, 2).map((category) => (
                  <span key={category} className="tag">
                    {category}
                  </span>
                ))}
              </div>

              <h2 style={{ margin: 0 }}>{story.title}</h2>
              {story.opening ? <p className="post-text clamp">{story.opening.content}</p> : null}

              <p className="hint" style={{ margin: 0 }}>
                {story.stageCount} {story.stageCount === 1 ? 'etapa' : 'etapas'} · Actualizado{' '}
                {formatDate(story.updatedAt)}
              </p>

              <div className="row-between">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="secondary"
                    type="button"
                    disabled={busyId === story.id || detailBusy}
                    onClick={() => void openDetail(story)}
                  >
                    Ver etapas
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    disabled={busyId === story.id}
                    onClick={() =>
                      setMetaStory({
                        id: story.id,
                        title: story.title,
                        visibility: story.visibility,
                        categories: story.categories,
                        emotions: story.emotions,
                        tags: story.tags,
                      })
                    }
                  >
                    Editar
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    disabled={busyId === story.id}
                    onClick={() => void toggleStatus(story)}
                  >
                    {busyId === story.id
                      ? '…'
                      : story.status === 'PUBLISHED'
                        ? 'Volver a borrador'
                        : 'Publicar'}
                  </button>
                </div>
                <button
                  className="link-danger"
                  type="button"
                  disabled={busyId === story.id}
                  onClick={() => void remove(story)}
                >
                  Dar de baja
                </button>
              </div>
            </article>
          ))}
        </div>

        {nextCursor ? (
          <div>
            <button
              className="btn-outline"
              type="button"
              disabled={loadingMore}
              onClick={() => {
                setLoadingMore(true);
                void loadStories(filter, nextCursor).finally(() => setLoadingMore(false));
              }}
            >
              {loadingMore ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        ) : null}
      </section>
    </WyFrame>
  );
}
