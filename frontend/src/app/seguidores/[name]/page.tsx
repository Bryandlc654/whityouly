'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import { fetchPublicProfile, type PublicProfile } from '@/lib/characters';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import {
  followCharacter,
  listFollowersOf,
  listFollowingOf,
  unfollowCharacter,
  type SocialConnection,
} from '@/lib/follows';

type Tab = 'followers' | 'following';
type PageStatus = 'loading' | 'ready' | 'missing' | 'unavailable';

const PAGE_SIZE = 20;

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function sameName(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

function decodeSegment(value?: string | null) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function ConnectionsPage() {
  const router = useRouter();
  const params = useParams<{ name: string }>();
  const rawName = Array.isArray(params.name) ? params.name[0] : params.name;
  const name = decodeSegment(rawName);

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [tab, setTab] = useState<Tab>('followers');

  const [items, setItems] = useState<SocialConnection[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState('');
  const [busyName, setBusyName] = useState<string | null>(null);

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const requestRef = useRef(0);

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

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/login');
        return;
      }

      const requestedTab = new URLSearchParams(window.location.search).get('tab');
      if (requestedTab === 'following') setTab('following');

      const [profileResult, meResponse] = await Promise.all([
        fetchPublicProfile(name),
        authFetch(`${API_URL}/characters/me`).catch(() => null),
      ]);

      if (!active) return;

      if (meResponse?.status === 401) {
        tokenStorage.clear();
        router.replace('/login');
        return;
      }

      let ownCharacter: CharacterSummary | null = null;

      if (meResponse?.ok) {
        try {
          ownCharacter = (await meResponse.json()) as CharacterSummary;
          setCharacter(ownCharacter);
        } catch {
          /* la lista funciona sin el avatar propio */
        }
      }

      if (profileResult.status === 'found') {
        setProfile(profileResult.profile);
        setStatus('ready');
        return;
      }

      // El perfil público de una cuenta privada responde 404, pero su dueño sí
      // debe poder abrir sus propias listas desde "Lo que sigo".
      if (ownCharacter && sameName(ownCharacter.name, name)) {
        setProfile({
          name: ownCharacter.name,
          tagline: ownCharacter.tagline ?? null,
          avatarUrl: ownCharacter.avatarUrl ?? null,
          bio: ownCharacter.bio ?? null,
          interests: ownCharacter.interests ?? [],
          showFollowing: ownCharacter.privacySettings?.showFollowing === true,
          createdAt: null,
        });
        setStatus('ready');
        return;
      }

      setStatus(profileResult.status === 'missing' ? 'missing' : 'unavailable');
    };

    void load();

    return () => {
      active = false;
    };
  }, [name, router]);

  const isOwnProfile = sameName(character?.name, profile?.name);
  const canSeeFollowing = Boolean(isOwnProfile || profile?.showFollowing);

  useEffect(() => {
    if (status !== 'ready' || !profile) return;

    if (tab === 'following' && !canSeeFollowing) {
      setTab('followers');
      return;
    }

    const requestId = ++requestRef.current;
    setListLoading(true);
    setListError('');
    setItems([]);
    setNextCursor(null);
    // Mientras llega la página, la pestaña muestra el contador del perfil.
    setTotal(tab === 'followers' ? profile.stats?.followers ?? 0 : profile.stats?.following ?? 0);

    void (async () => {
      const result =
        tab === 'followers'
          ? await listFollowersOf(profile.name, { limit: PAGE_SIZE })
          : await listFollowingOf(profile.name, { limit: PAGE_SIZE });

      if (requestId !== requestRef.current) return;

      if (result.status === 'ok') {
        setItems(result.data.items);
        setTotal(result.data.total);
        setNextCursor(result.data.nextCursor);
      } else {
        setListError(result.message);
        setTotal(0);
      }

      setListLoading(false);
    })();
  }, [status, profile, tab, canSeeFollowing]);

  const changeTab = (next: Tab) => {
    setTab(next);

    // La pestaña queda en la URL para que el enlace se pueda compartir y
    // recargar sin volver a "Seguidores".
    try {
      const url = new URL(window.location.href);
      if (next === 'following') {
        url.searchParams.set('tab', 'following');
      } else {
        url.searchParams.delete('tab');
      }
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    } catch {
      /* sin URL válida, la pestaña sigue funcionando en memoria */
    }
  };

  const loadMore = async () => {
    if (!profile || !nextCursor || loadingMore) return;

    const requestId = requestRef.current;
    setLoadingMore(true);

    const result =
      tab === 'followers'
        ? await listFollowersOf(profile.name, { cursor: nextCursor, limit: PAGE_SIZE })
        : await listFollowingOf(profile.name, { cursor: nextCursor, limit: PAGE_SIZE });

    if (requestId !== requestRef.current) {
      setLoadingMore(false);
      return;
    }

    if (result.status === 'ok') {
      setItems((prev) => [...prev, ...result.data.items]);
      setTotal(result.data.total);
      setNextCursor(result.data.nextCursor);
    } else {
      notify(result.message);
    }

    setLoadingMore(false);
  };

  const toggleFollow = async (person: SocialConnection) => {
    if (person.isSelf) return;

    const wasFollowing = person.following;
    setBusyName(person.name);

    const result = wasFollowing
      ? await unfollowCharacter(person.name)
      : await followCharacter(person.name);

    setBusyName(null);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.name === person.name ? { ...item, following: !wasFollowing } : item,
      ),
    );

    if (tab === 'following' && wasFollowing) {
      setItems((prev) => prev.filter((item) => item.name !== person.name));
      setTotal((value) => Math.max(0, value - 1));
    }

    notify(
      wasFollowing
        ? `Dejaste de seguir a ${person.name}.`
        : `Ahora sigues a ${person.name}.`,
    );
  };

  const openProfile = (person: SocialConnection) => {
    if (person.isSelf) {
      router.push('/cuenta');
      return;
    }
    router.push(`/personaje/${encodeURIComponent(person.name)}`);
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
        { label: 'Mis relatos', icon: 'book', onClick: () => router.push('/mis-relatos') },
        { label: 'Lo que sigo', icon: 'users', onClick: () => router.push('/siguiendo') },
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
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
      case 'explore':
        router.push('/explorar');
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

  const profileName = profile?.name ?? name;

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="character"
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
        <div className="screen-heading">
          <div>
            <button
              className="ghost"
              type="button"
              onClick={() =>
                router.push(
                  isOwnProfile ? '/cuenta' : `/personaje/${encodeURIComponent(name)}`,
                )
              }
            >
              ← {isOwnProfile ? 'Mi cuenta' : 'Perfil'}
            </button>
            <h1>{tab === 'followers' ? 'Seguidores' : 'Siguiendo'}</h1>
            <p>{profileName}</p>
          </div>
        </div>

        {status === 'loading' ? <p className="muted small">Cargando…</p> : null}

        {status === 'missing' || status === 'unavailable' ? (
          <div className="empty card">
            <div className="empty-icon">
              <Icon name="users" />
            </div>
            <h2>Perfil no disponible</h2>
            <p>
              {status === 'missing'
                ? 'Este perfil no existe o prefiere no mostrarse en la comunidad.'
                : 'No se pudo comprobar el perfil. Inténtalo de nuevo en un momento.'}
            </p>
            <button className="secondary" type="button" onClick={() => router.push('/feed')}>
              Volver al inicio
            </button>
          </div>
        ) : null}

        {status === 'ready' && profile ? (
          <>
            <div className="segmented" role="tablist" aria-label="Listas del perfil">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'followers'}
                className={tab === 'followers' ? 'active' : undefined}
                onClick={() => changeTab('followers')}
              >
                Seguidores ({tab === 'followers' ? total : profile.stats?.followers ?? 0})
              </button>
              {canSeeFollowing ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'following'}
                  className={tab === 'following' ? 'active' : undefined}
                  onClick={() => changeTab('following')}
                >
                  Siguiendo ({tab === 'following' ? total : profile.stats?.following ?? 0})
                </button>
              ) : null}
            </div>

            {!canSeeFollowing ? (
              <p className="hint" style={{ margin: 0 }}>
                <Icon name="lock" /> Este perfil no comparte a quién sigue.
              </p>
            ) : null}

            {listLoading ? <p className="muted small">Cargando la lista…</p> : null}

            {!listLoading && listError ? (
              <div className="auth-error" role="alert">
                {listError}
              </div>
            ) : null}

            {!listLoading && !listError && items.length === 0 ? (
              <div className="empty card">
                <div className="empty-icon">
                  <Icon name="users" />
                </div>
                <h2>
                  {tab === 'followers'
                    ? 'Todavía no hay seguidores'
                    : 'Aún no sigue a nadie'}
                </h2>
                <p>
                  {tab === 'followers'
                    ? 'Cuando alguien siga este perfil aparecerá aquí.'
                    : 'Explora relatos y autores para descubrir nuevas voces.'}
                </p>
                <button className="secondary" type="button" onClick={() => router.push('/explorar')}>
                  Explorar relatos
                </button>
              </div>
            ) : null}

            {items.length > 0 ? (
              <section className="card pad">
                <div className="social-people">
                  {items.map((person) => (
                    <article className="social-person" key={`${tab}-${person.name}`}>
                      <Avatar
                        initials={initialsOf(person.name)}
                        avatarUrl={person.avatarUrl}
                        size="sm"
                      />
                      <div className="social-person-main">
                        <button
                          className="social-person-name"
                          type="button"
                          onClick={() => openProfile(person)}
                        >
                          {person.name}
                          {person.isSelf ? <span className="muted small"> (tú)</span> : null}
                        </button>
                        <small>
                          @{person.name.toLowerCase().replace(/\s+/g, '')}
                          {person.tagline ? ` · ${person.tagline}` : ''}
                        </small>
                      </div>
                      {person.isSelf ? (
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => router.push('/cuenta')}
                        >
                          Mi cuenta
                        </button>
                      ) : (
                        <button
                          className={person.following ? 'secondary on' : 'secondary'}
                          type="button"
                          aria-pressed={person.following}
                          disabled={busyName === person.name}
                          onClick={() => void toggleFollow(person)}
                        >
                          {person.following ? 'Siguiendo' : 'Seguir'}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {nextCursor ? (
              <div>
                <button
                  className="btn-outline"
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? 'Cargando…' : 'Ver más'}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </WyFrame>
  );
}
