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
import StoryComposer from '@/components/wy/StoryComposer';
import { DEMO_STORIES } from '@/components/wy/feedData';

type FeedTab = 'for-you' | 'following';

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

export default function FeedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState<CharacterSummary | null>(null);

  const [feedTab, setFeedTab] = useState<FeedTab>('for-you');
  const [supported, setSupported] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [followAuthors, setFollowAuthors] = useState<Set<string>>(new Set());
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

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

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
        { label: 'Configuración de la cuenta', icon: 'settings', onClick: () => router.push('/cuenta') },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  const openMood = (name = 'Esperanza') => {
    setMoodName(name);
    setMoodOpen(true);
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
        router.push('/siguiendo');
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
  const stories =
    feedTab === 'following'
      ? DEMO_STORIES.filter((story) => followAuthors.has(story.author) || story.id === 'pausa')
      : DEMO_STORIES;

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
        composerOpen ? (
          <StoryComposer
            onClose={() => setComposerOpen(false)}
            onCreated={() => {
              setComposerOpen(false);
              notify('Tu relato se guardó. Estará en «Mis relatos».');
            }}
          />
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

        <section className="composer card">
          <div className="composer-top">
            <Avatar initials={initials} avatarUrl={character?.avatarUrl} />
            <button
              className="composer-trigger"
              type="button"
              onClick={() => setComposerOpen(true)}
            >
              ¿Qué necesitas sacar de tu pecho hoy?
            </button>
          </div>
          <div className="composer-meta">
            <span>
              <Icon name="lock" /> Publicarás como <strong>{name || 'tu seudónimo'}</strong>
            </span>
            <button
              className="text-link"
              type="button"
              onClick={() => notify('La consigna diaria llega con el módulo de historias.')}
            >
              Responder consigna diaria
            </button>
          </div>
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

        <div id="feedList">
          {stories.length ? (
            stories.map((story) => (
              <PostCard
                key={story.id}
                story={story}
                supported={supported.has(story.id)}
                saved={saved.has(story.id)}
                followingAuthor={followAuthors.has(story.author)}
                followingStory={followStories.has(story.id)}
                onSupport={() => toggle(setSupported, story.id, 'Tu apoyo fue enviado', 'Quitaste tu apoyo')}
                onSave={() => toggle(setSaved, story.id, 'Relato guardado', 'Relato eliminado de guardados')}
                onFollowAuthor={() =>
                  toggle(setFollowAuthors, story.author, `Ahora sigues a ${story.author}`, `Dejaste de seguir a ${story.author}`)
                }
                onFollowStory={() =>
                  toggle(setFollowStories, story.id, 'Recibirás futuras actualizaciones de este relato', 'Dejaste de seguir sus actualizaciones')
                }
                onOpenMenu={() => openPostMenu(story.id)}
                onPlay={() => notify('Reproduciendo vista previa')}
                onAuthor={() => notify(`El perfil de ${story.author} llega con el módulo de comunidad.`)}
                onComment={() => notify('Los comentarios llegan con el módulo de acompañamiento.')}
              />
            ))
          ) : (
            <div className="empty card">
              <div className="empty-icon">
                <Icon name="users" />
              </div>
              <h2>Aún no sigues a nadie</h2>
              <p>Explora autores con los que conectes. Aquí aparecerán sus nuevos relatos.</p>
              <button
                className="primary"
                type="button"
                style={{ padding: '12px 18px' }}
                onClick={() => notify('La exploración de comunidad llega pronto.')}
              >
                Explorar comunidad
              </button>
            </div>
          )}
        </div>
      </section>
    </WyFrame>
  );
}
