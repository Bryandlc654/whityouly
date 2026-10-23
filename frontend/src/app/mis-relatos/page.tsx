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
  featureStory,
  getMyStory,
  listMyStories,
  publishStory,
  unfeatureStory,
  unpublishStory,
  withdrawStory,
  type MyStory,
  type MyStoryListItem,
  type StoryStatus,
} from '@/lib/stories';
import {
  APPEAL_MESSAGE_MAX_LENGTH,
  APPEAL_MESSAGE_MIN_LENGTH,
  createAppeal,
  listMyAppeals,
  type Appeal,
} from '@/lib/moderation';

type StatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED';

// Estados en los que un relato propio está oculto (moderado) y, por tanto, se
// puede apelar. Coincide con las condiciones del backend.
const APPEALABLE_STATUSES: StoryStatus[] = ['HIDDEN', 'MODERATED', 'REPORTED'];

function isAppealable(status: StoryStatus): boolean {
  return APPEALABLE_STATUSES.includes(status);
}

function statusLabel(status: StoryStatus): string {
  if (status === 'PUBLISHED') return 'Publicado';
  if (status === 'WITHDRAWN') return 'Retirado';
  if (status === 'HIDDEN' || status === 'MODERATED' || status === 'REPORTED') return 'Oculto por moderación';
  return 'Borrador';
}

const APPEAL_STATUS_LABELS: Record<Appeal['status'], string> = {
  PENDING: 'Apelación en revisión',
  ACCEPTED: 'Apelación aceptada',
  REJECTED: 'Apelación rechazada',
};

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

function visibilityLabel(visibility: MyStoryListItem['visibility']): string {
  if (visibility === 'PUBLIC') return 'Público';
  if (visibility === 'FOLLOWERS') return 'Seguidores';
  return 'Privado';
}

function visibilityIcon(visibility: MyStoryListItem['visibility']): 'globe' | 'users' | 'lock' {
  if (visibility === 'PUBLIC') return 'globe';
  if (visibility === 'FOLLOWERS') return 'users';
  return 'lock';
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

  // Apelaciones: por relato, para saber si ya hay una pendiente o resuelta.
  const [appeals, setAppeals] = useState<Record<string, Appeal>>({});
  const [appealFor, setAppealFor] = useState<string | null>(null);
  const [appealDraft, setAppealDraft] = useState('');
  const [appealBusy, setAppealBusy] = useState(false);

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

  const loadAppeals = useCallback(async () => {
    const result = await listMyAppeals({ limit: 50 });
    if (result.status !== 'ok') return;
    const map: Record<string, Appeal> = {};
    for (const appeal of result.data.items) {
      if (appeal.targetType !== 'STORY') continue;
      const current = map[appeal.targetId];
      // Nos quedamos con la apelación más reciente de cada relato.
      if (!current || appeal.createdAt > current.createdAt) {
        map[appeal.targetId] = appeal;
      }
    }
    setAppeals(map);
  }, []);

  useEffect(() => {
    if (!loading) void loadAppeals();
  }, [loading, loadAppeals]);

  const openAppeal = (storyId: string) => {
    setAppealFor(storyId);
    setAppealDraft('');
  };

  const submitAppeal = async (storyId: string) => {
    const message = appealDraft.trim();
    if (message.length < APPEAL_MESSAGE_MIN_LENGTH) {
      notify(`Cuéntanos un poco más (mínimo ${APPEAL_MESSAGE_MIN_LENGTH} caracteres).`);
      return;
    }

    setAppealBusy(true);
    const result = await createAppeal('STORY', storyId, message);
    setAppealBusy(false);

    if (result.status === 'ok') {
      setAppeals((prev) => ({ ...prev, [storyId]: result.data }));
      setAppealFor(null);
      setAppealDraft('');
      notify('Apelación enviada. La revisaremos pronto.');
      return;
    }
    notify(result.message);
  };

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Ir al Feed', icon: 'home', onClick: () => router.push('/feed') },
        {
          label: 'Relatos retirados',
          icon: 'lock',
          onClick: () => router.push('/mis-relatos/retirados'),
        },
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
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

  const confirmWithdraw = (story: MyStoryListItem) => {
    setSheet({
      title: '¿Retirar este relato?',
      rows: [
        {
          label: 'Conservar relato',
          icon: 'shield',
          onClick: () => setSheet(null),
        },
        {
          label: 'Retirar y permitir restauración',
          icon: 'lock',
          danger: true,
          onClick: () => void withdraw(story),
        },
      ],
    });
  };

  const confirmDelete = (story: MyStoryListItem) => {
    setSheet({
      title: '¿Eliminar este borrador?',
      rows: [
        {
          label: 'Conservar borrador',
          icon: 'shield',
          onClick: () => setSheet(null),
        },
        {
          label: 'Eliminar definitivamente',
          icon: 'trash',
          danger: true,
          onClick: () => void remove(story),
        },
      ],
    });
  };

  const withdraw = async (story: MyStoryListItem) => {
    setBusyId(story.id);
    const result = await withdrawStory(story.id);
    setBusyId(null);

    if (result.status === 'ok') {
      setStories((prev) => prev.filter((item) => item.id !== story.id));
      notify('Relato retirado. Puedes restaurarlo desde “Relatos retirados”.');
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
      notify('Borrador eliminado definitivamente.');
      return;
    }
    notify(result.message);
  };

  const toggleFeatured = async (story: MyStoryListItem) => {
    setBusyId(story.id);
    const result = story.featuredAt ? await unfeatureStory(story.id) : await featureStory(story.id);
    setBusyId(null);

    if (result.status === 'ok') {
      notify(story.featuredAt ? 'Quitado de las destacadas.' : 'Relato destacado en tu perfil.');
      void loadStories(filter);
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
          onMood={() => router.push('/mi-estado')}
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
          <div className="heading-actions">
            <button
              className="secondary keep-mobile"
              type="button"
              onClick={() => router.push('/mis-relatos/retirados')}
            >
              <Icon name="lock" /> Relatos retirados
            </button>
            <button className="secondary" type="button" onClick={() => setComposerOpen(true)}>
              <Icon name="plus" />
              Compartir relato
            </button>
          </div>
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

        {stories.length > 0 ? (
          <div className="story-list">
            {stories.map((story) => (
              <article key={story.id} className="card story-row">
                <div className="story-row-head">
                  <h2>{story.title}</h2>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {story.featuredAt ? (
                      <span className="status-pill featured">Destacado</span>
                    ) : null}
                    <span
                      className={`status-pill ${
                        story.status === 'PUBLISHED'
                          ? 'published'
                          : isAppealable(story.status)
                            ? 'featured'
                            : 'draft'
                      }`}
                    >
                      {statusLabel(story.status)}
                    </span>
                  </div>
                </div>

                <p className="story-row-meta">
                  <Icon name={visibilityIcon(story.visibility)} />
                  <span>{visibilityLabel(story.visibility)}</span>
                  <span className="dot" aria-hidden />
                  <span>
                    {story.stageCount} {story.stageCount === 1 ? 'etapa' : 'etapas'}
                  </span>
                  <span className="dot" aria-hidden />
                  <span>{formatDate(story.updatedAt)}</span>
                  {story.categories[0] ? (
                    <>
                      <span className="dot" aria-hidden />
                      <span>{story.categories[0]}</span>
                    </>
                  ) : null}
                </p>

                {story.opening ? <p className="post-text clamp">{story.opening.content}</p> : null}

                <div className="story-row-actions">
                  <button
                    className="action-link"
                    type="button"
                    disabled={busyId === story.id || detailBusy}
                    onClick={() => void openDetail(story)}
                  >
                    <Icon name="book" /> Etapas
                  </button>
                  <button
                    className="action-link"
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
                    <Icon name="edit" /> Editar
                  </button>
                  <button
                    className="action-link"
                    type="button"
                    disabled={busyId === story.id}
                    onClick={() => void toggleFeatured(story)}
                  >
                    <Icon name="sparkle" /> {story.featuredAt ? 'Quitar destacado' : 'Destacar'}
                  </button>
                  {isAppealable(story.status) ? (
                    <button
                      className="action-link"
                      type="button"
                      disabled={appealBusy || Boolean(appeals[story.id])}
                      onClick={() => openAppeal(story.id)}
                    >
                      <Icon name="flag" /> Apelar
                    </button>
                  ) : (
                    <button
                      className="action-link"
                      type="button"
                      disabled={busyId === story.id}
                      onClick={() => void toggleStatus(story)}
                    >
                      <Icon name={story.status === 'PUBLISHED' ? 'lock' : 'globe'} />
                      {story.status === 'PUBLISHED' ? 'Volver a borrador' : 'Publicar'}
                    </button>
                  )}
                  {story.status === 'PUBLISHED' ? (
                    <button
                      className="action-link danger"
                      type="button"
                      disabled={busyId === story.id}
                      onClick={() => confirmWithdraw(story)}
                    >
                      <Icon name="lock" /> Retirar relato
                    </button>
                  ) : story.status === 'DRAFT' ? (
                    <button
                      className="action-link danger"
                      type="button"
                      disabled={busyId === story.id}
                      onClick={() => confirmDelete(story)}
                    >
                      <Icon name="trash" /> Eliminar borrador
                    </button>
                  ) : null}
                </div>

                {isAppealable(story.status) ? (
                  <div className="appeal-block">
                    {appeals[story.id] ? (
                      <div className="appeal-status">
                        <strong>{APPEAL_STATUS_LABELS[appeals[story.id].status]}</strong>
                        <p className="muted small" style={{ margin: '4px 0 0' }}>
                          {appeals[story.id].message}
                        </p>
                        {appeals[story.id].resolutionNote ? (
                          <p className="muted small" style={{ margin: '4px 0 0' }}>
                            Respuesta de moderación: {appeals[story.id].resolutionNote}
                          </p>
                        ) : null}
                      </div>
                    ) : appealFor === story.id ? (
                      <div className="appeal-form">
                        <label className="field-label" htmlFor={`appeal-${story.id}`}>
                          Cuéntanos por qué deberíamos revisarlo
                        </label>
                        <textarea
                          id={`appeal-${story.id}`}
                          className="field"
                          rows={3}
                          maxLength={APPEAL_MESSAGE_MAX_LENGTH}
                          value={appealDraft}
                          onChange={(event) => setAppealDraft(event.target.value)}
                          placeholder="Explica por qué tu relato no incumple las normas de la comunidad."
                        />
                        <div className="appeal-actions">
                          <button
                            className="primary"
                            type="button"
                            disabled={appealBusy}
                            onClick={() => void submitAppeal(story.id)}
                          >
                            {appealBusy ? 'Enviando…' : 'Enviar apelación'}
                          </button>
                          <button
                            className="text-link"
                            type="button"
                            disabled={appealBusy}
                            onClick={() => {
                              setAppealFor(null);
                              setAppealDraft('');
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="muted small" style={{ margin: '8px 0 0' }}>
                        Este relato está oculto por moderación. Si crees que es un error, puedes apelar
                        con el botón «Apelar».
                      </p>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

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
