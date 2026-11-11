'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { countryLabel, languageLabel } from '@/lib/locales';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import StoryViewer from '@/components/wy/StoryViewer';
import ShareStoryModal, { type ShareStoryData } from '@/components/wy/ShareStoryModal';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import { viewPublicStory, viewStory, type MyStory } from '@/lib/stories';
import PageSkeleton, { SkeletonList } from '@/components/wy/PageSkeleton';
import JoinPrompt from '@/components/wy/JoinPrompt';
import { followStory, listSupportedStoryIds, supportStory, unfollowStory, unsupportStory } from '@/lib/interactions';
import { whatIFollow } from '@/lib/follows';
import { rememberReturnTo } from '@/lib/returnTo';
import { useI18n } from '@/components/providers/I18nProvider';

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function StoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const storyId = typeof params?.id === 'string' ? params.id : '';
  const { t, language } = useI18n();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<MyStory | null>(null);
  const [storyLoading, setStoryLoading] = useState(true);
  const [translated, setTranslated] = useState(true);
  const [error, setError] = useState('');

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [shareStory, setShareStory] = useState<ShareStoryData | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  // Sin sesión se lee el relato compartido; para interactuar hay que unirse.
  const [guest, setGuest] = useState(false);
  const [joinReason, setJoinReason] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [supportCount, setSupportCount] = useState(0);
  const [followingStory, setFollowingStory] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const loadStory = useCallback(async () => {
    if (!storyId) {
      setError('No encontramos ese relato.');
      setStoryLoading(false);
      return;
    }

    setStoryLoading(true);
    setError('');
    const result = tokenStorage.getAccess() ? await viewStory(storyId) : await viewPublicStory(storyId);
    setStoryLoading(false);

    if (result.status === 'ok') {
      setStory(result.data);
      setSupportCount(result.data.supportCount);
      return;
    }

    setStory(null);
    setError(result.message);
  }, [storyId]);

  useEffect(() => {
    const verify = async () => {
      if (!tokenStorage.getAccess()) {
        setGuest(true);
        setLoading(false);
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

        void listSupportedStoryIds().then((supportResult) => {
          if (supportResult.status === 'ok') setSupported(supportResult.data.storyIds.includes(storyId));
        });
        void whatIFollow().then((followResult) => {
          if (followResult.status === 'ok') {
            setFollowingStory(followResult.data.stories.some((item) => item.id === storyId));
          }
        });

      } catch (err) {
        console.error('Error verificando sesión', err);
      } finally {
        setLoading(false);
      }
    };

    void verify();
  }, [router, storyId]);

  useEffect(() => {
    if (!loading) void loadStory();
  }, [loading, loadStory]);

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
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
        { label: 'Ayuda y soporte', icon: 'mail', onClick: () => router.push('/soporte') },
        { label: 'Configuración de la cuenta', icon: 'settings', onClick: () => router.push('/cuenta/configuracion') },
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
      case 'profile':
        router.push('/cuenta');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'mood':
        router.push('/mi-diario');
        break;
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'help':
        router.push('/ayuda');
        break;
      case 'notifications':
        router.push('/notificaciones');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const returnTo = `/relato/${encodeURIComponent(storyId)}`;

  const askToJoin = (reason: string) => setJoinReason(reason);

  const toggleSupport = async () => {
    if (guest) return askToJoin('Inicia sesión para decir «Estoy contigo»');
    if (!story || busyAction) return;
    setBusyAction(true);
    const result = supported ? await unsupportStory(story.id) : await supportStory(story.id);
    setBusyAction(false);
    if (result.status === 'ok') {
      setSupported(result.data.supporting);
      setSupportCount(result.data.count);
      return;
    }
    notify(result.message);
  };

  const toggleFollowStory = async () => {
    if (guest) return askToJoin('Inicia sesión para seguir esta historia');
    if (!story || busyAction) return;
    setBusyAction(true);
    const result = followingStory ? await unfollowStory(story.id) : await followStory(story.id);
    setBusyAction(false);
    if (result.status === 'ok') {
      setFollowingStory(result.data.following);
      notify(result.data.following ? 'Te avisaremos cuando continúe.' : 'Ya no sigues esta historia.');
      return;
    }
    notify(result.message);
  };

  const scrollToComments = () => {
    if (guest) return askToJoin('Inicia sesión para leer y escribir comentarios');
    document.querySelector('.story-reader-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openShare = () => {
    if (!story) return;
    setShareStory({
      id: story.id,
      title: story.title,
      text: story.updates[0]?.content ?? '',
      author: story.author?.name ?? 'Withyouly',
      initials: initialsOf(story.author?.name),
      category: story.categories[0],
      externalShare: story.externalShare,
      guestReadable: story.guestReadable,
      format: story.updates[0]?.audioUrl
        ? 'Audio con transcripción'
        : story.visualCardTheme
          ? 'Tarjeta visual'
          : 'Relato escrito',
    });
  };

  const goAuth = (path: '/login' | '/register') => {
    rememberReturnTo(returnTo);
    router.push(path);
  };

  if (loading) {
    return (
      <PageSkeleton variant="detail" />
    );
  }

  const tags = story ? [...story.categories, ...story.tags].slice(0, 5) : [];
  const translation = story?.translations?.[language] ?? null;
  const displayStory =
    story && translated && translation
      ? {
          ...story,
          title: translation.title,
          updates: story.updates.map((stage, index) =>
            index === 0 ? { ...stage, content: translation.content } : stage,
          ),
        }
      : story;


  const overlay = shareStory ? (
    <ShareStoryModal story={shareStory} onClose={() => setShareStory(null)} onNotify={notify} />
  ) : joinReason ? (
    <JoinPrompt returnTo={returnTo} reason={joinReason} onClose={() => setJoinReason(null)} />
  ) : null;

  const content = (
      <section className="screen story-page">
          {!guest ? (
            <button
              className="text-link story-back"
              type="button"
              onClick={() => (window.history.length > 1 ? router.back() : router.push('/feed'))}
            >
              <Icon name="chevron" /> Volver
            </button>
          ) : null}
  
          {storyLoading ? <SkeletonList kind="post" count={1} /> : null}
  
          {!storyLoading && error && guest ? (
            <JoinPrompt
              variant="card"
              returnTo={returnTo}
              reason="Este relato solo está disponible para la comunidad"
            />
          ) : null}
  
          {!storyLoading && error && !guest ? (
            <div className="auth-error" role="alert">
              {error}
              <button className="text-link" type="button" onClick={() => void loadStory()} style={{ marginLeft: 8 }}>
                Reintentar
              </button>
            </div>
          ) : null}
  
          {!storyLoading && !error && story ? (
            <article className="post card story-page-card">
              <div className="post-head">
                <Avatar
                  initials={initialsOf(story.author?.name)}
                  avatarUrl={story.author?.avatarUrl}
                  size="sm"
                />
                <div>
                  <div className="post-author">
                    <span className="author-name">{story.author?.name ?? 'Autor desconocido'}</span>
                  </div>
                  <div className="post-time">
                    {formatDate(story.createdAt)} · {story.updates.length}{' '}
                    {story.updates.length === 1 ? 'etapa' : 'etapas'} · {languageLabel(story.language)}
                    {story.countryCode ? ` · ${countryLabel(story.countryCode)}` : ''}
                  </div>
                </div>
              </div>
  
              {tags.length > 0 || translation ? (
                <div className="post-tags">
                  {tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                  {translation ? (
                    <button className="tag translation-toggle" type="button" onClick={() => setTranslated((value) => !value)}>
                      {translated ? t('post.viewOriginal') : `${t('post.viewTranslation')} (${languageLabel(language)})`}
                    </button>
                  ) : null}
                </div>
              ) : null}
  
              <h1 className={displayStory?.visualCardTheme ? 'visually-hidden' : 'story-page-title'}>
                {displayStory?.title ?? story.title}
              </h1>
  
              <div className="story-page-meta">
                <span>
                  {supportCount} {supportCount === 1 ? 'persona está' : 'personas están'} contigo
                </span>
                <span>
                  {story.commentCount} {story.commentCount === 1 ? 'comentario' : 'comentarios'}
                </span>
              </div>
  
              <div className="post-actions story-page-actions">
                <button
                  type="button"
                  className={supported ? 'active' : ''}
                  aria-pressed={supported}
                  onClick={() => void toggleSupport()}
                >
                  <Icon name="heart" />
                  <span className="action-label">Estoy contigo</span>
                </button>
                <button type="button" onClick={scrollToComments}>
                  <Icon name="message" />
                  <span className="action-label">Comentar</span>
                </button>
                <button
                  type="button"
                  className={followingStory ? 'active' : ''}
                  aria-pressed={followingStory}
                  onClick={() => void toggleFollowStory()}
                >
                  <Icon name="trend" />
                  <span className="action-label">{followingStory ? 'Siguiendo' : 'Seguir relato'}</span>
                </button>
                <button type="button" onClick={openShare}>
                  <Icon name="share" />
                  <span className="action-label">Compartir</span>
                </button>
              </div>
  
              <StoryViewer
                story={displayStory ?? story}
                variant="page"
                onNotify={notify}
                onClose={() => router.push('/feed')}
                guest={guest ? { returnTo } : undefined}
              />
            </article>
          ) : null}
        </section>
  );

  // Enlace compartido abierto sin sesión: lectura pública con un marco ligero,
  // como una publicación pública de Facebook. Interactuar pide unirse.
  if (guest) {
    return (
      <div className="wy feed-reference guest-story">
        <header className="topbar">
          <div className="topbar-inner">
            <button className="brand" type="button" onClick={() => router.push('/')} aria-label="Ir a Withyouly">
              <span className="brand-crop" role="img" aria-label="Withyouly" />
            </button>
            <div className="guest-story-actions">
              <button className="ghost" type="button" onClick={() => goAuth('/login')}>
                Iniciar sesión
              </button>
              <button className="primary" type="button" onClick={() => goAuth('/register')}>
                Crear cuenta
              </button>
            </div>
          </div>
        </header>
        <main className="guest-story-main" id="main">
          <p className="guest-story-note">
            <Icon name="lock" /> Estás leyendo un relato compartido. Únete para acompañar, comentar o seguir historias.
          </p>
          {content}
        </main>
        {overlay ? <div className="modal-layer">{overlay}</div> : null}
        <div className={`toast ${toast ? 'show' : ''}`} role="status">
          {toast}
        </div>
      </div>
    );
  }

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="character"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      overlay={overlay}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      {content}
    </WyFrame>
  );
}
