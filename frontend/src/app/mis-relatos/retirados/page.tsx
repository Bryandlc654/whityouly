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
import {
  deleteStory,
  listWithdrawnStories,
  restoreStory,
  type MyStoryListItem,
} from '@/lib/stories';

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function WithdrawnStoriesPage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [stories, setStories] = useState<MyStoryListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const load = useCallback(async (cursor?: string) => {
    if (!cursor) setListError('');

    const result = await listWithdrawnStories({ cursor });

    if (result.status === 'ok') {
      setStories((prev) => (cursor ? [...prev, ...result.data.items] : result.data.items));
      setNextCursor(result.data.nextCursor);
      return;
    }

    setListError(result.message);
    if (!cursor) setStories([]);
  }, []);

  useEffect(() => {
    const verify = async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/login');
        return;
      }

      try {
        const response = await authFetch(`${API_URL}/characters/me`);

        if (response.status === 401) {
          tokenStorage.clear();
          router.replace('/login');
          return;
        }

        if (response.status === 404) {
          router.replace('/onboarding');
          return;
        }

        if (response.ok) {
          setCharacter(await response.json());
        }

        await load();
      } catch {
        setListError('No se pudieron cargar tus relatos retirados.');
      } finally {
        setLoading(false);
      }
    };

    void verify();
  }, [router, load]);

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
        {
          label: 'Editar perfil',
          icon: 'edit',
          onClick: () => router.push('/perfil/editar'),
        },
        {
          label: 'Configuración de la cuenta',
          icon: 'settings',
          onClick: () => router.push('/cuenta'),
        },
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
      case 'following':
        router.push('/siguiendo');
        break;
      case 'profile':
        router.push('/cuenta');
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

  const restore = async (story: MyStoryListItem) => {
    setBusyId(story.id);
    const result = await restoreStory(story.id);
    setBusyId(null);

    if (result.status === 'ok') {
      setStories((prev) => prev.filter((item) => item.id !== story.id));
      notify('Relato restaurado. Ya vuelve a estar publicado.');
      return;
    }

    notify(result.message);
  };

  const confirmDelete = (story: MyStoryListItem) => {
    setSheet({
      title: '¿Eliminar definitivamente?',
      rows: [
        {
          label: 'Conservar relato retirado',
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

  const remove = async (story: MyStoryListItem) => {
    setBusyId(story.id);
    const result = await deleteStory(story.id);
    setBusyId(null);

    if (result.status === 'ok') {
      setStories((prev) => prev.filter((item) => item.id !== story.id));
      notify('Relato eliminado definitivamente.');
      return;
    }

    notify(result.message);
  };

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="my-stories"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onDaily={() => notify('La consigna diaria llega con el módulo de historias.')}
          onCategory={(category) => router.push(`/explorar?category=${encodeURIComponent(category)}`)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen">
        <div className="welcome-row">
          <div>
            <button className="ghost" type="button" onClick={() => router.push('/mis-relatos')}>
              ← Mis relatos
            </button>
            <h1>Relatos retirados</h1>
            <p className="muted small">
              Conservan sus etapas y comentarios. Puedes restaurarlos cuando quieras.
            </p>
          </div>
        </div>

        {loading ? <p className="muted small">Cargando…</p> : null}

        {!loading && listError ? (
          <div className="auth-error" role="alert">
            {listError}
            <button
              className="text-link"
              type="button"
              style={{ marginLeft: 8 }}
              onClick={() => void load()}
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {!loading && !listError && stories.length === 0 ? (
          <div className="empty card">
            <div className="empty-icon">
              <Icon name="lock" />
            </div>
            <h2>No tienes relatos retirados</h2>
            <p>Cuando retires un relato aparecerá aquí y podrás restaurarlo.</p>
            <button
              className="primary"
              type="button"
              style={{ padding: '12px 18px' }}
              onClick={() => router.push('/mis-relatos')}
            >
              Volver a mis relatos
            </button>
          </div>
        ) : null}

        {stories.length > 0 ? (
          <div className="story-list">
            {stories.map((story) => (
              <article key={story.id} className="card story-row">
                <div className="story-row-head">
                  <h2>{story.title}</h2>
                  <span className="status-pill featured">Retirado</span>
                </div>

                <p className="story-row-meta">
                  <Icon name="lock" />
                  <span>Retirado el {formatDate(story.withdrawnAt)}</span>
                  <span className="dot" aria-hidden />
                  <span>
                    {story.stageCount} {story.stageCount === 1 ? 'etapa' : 'etapas'}
                  </span>
                  <span className="dot" aria-hidden />
                  <span>{story.commentCount} comentarios</span>
                </p>

                <div className="story-row-actions">
                  <button
                    className="action-link"
                    type="button"
                    disabled={busyId === story.id}
                    onClick={() => void restore(story)}
                  >
                    <Icon name="globe" /> Restaurar
                  </button>
                  <button
                    className="action-link danger"
                    type="button"
                    disabled={busyId === story.id}
                    onClick={() => confirmDelete(story)}
                  >
                    <Icon name="trash" /> Eliminar definitivamente
                  </button>
                </div>
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
                if (!nextCursor || loadingMore) return;
                setLoadingMore(true);
                void load(nextCursor).finally(() => setLoadingMore(false));
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
