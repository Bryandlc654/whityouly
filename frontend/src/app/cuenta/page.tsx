'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { fetchAccount, type Account } from '@/lib/account';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import { fetchPublicProfile } from '@/lib/characters';
import { listFollowersOf, listFollowingOf } from '@/lib/follows';
import { listMyStories } from '@/lib/stories';

interface ProfileStats {
  stories: number;
  companionships: number;
  followers: number;
  following: number;
}

const EMPTY_STATS: ProfileStats = {
  stories: 0,
  companionships: 0,
  followers: 0,
  following: 0,
};

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [stats, setStats] = useState<ProfileStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    const load = async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/login');
        return;
      }

      try {
        const accountResult = await fetchAccount();
        if (accountResult.status === 'ok') setAccount(accountResult.data);
      } catch {
        /* el perfil puede cargarse sin los datos de la cuenta */
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
        if (!res.ok) {
          setError('No se pudo cargar tu perfil.');
          setLoading(false);
          return;
        }

        const loadedCharacter: CharacterSummary = await res.json();
        setCharacter(loadedCharacter);

        const name = loadedCharacter.name;
        const [publicProfile, followersResult, followingResult, storiesResult] = await Promise.all([
          fetchPublicProfile(name),
          listFollowersOf(name, { limit: 1 }),
          listFollowingOf(name, { limit: 1 }),
          listMyStories({ status: 'PUBLISHED' }),
        ]);

        const publishedStories = storiesResult.status === 'ok' ? storiesResult.data.items : [];
        const fallback: ProfileStats = {
          stories: publishedStories.length,
          companionships: publishedStories.reduce((total, story) => total + story.supportCount, 0),
          followers: followersResult.status === 'ok' ? followersResult.data.total : 0,
          following: followingResult.status === 'ok' ? followingResult.data.total : 0,
        };

        if (publicProfile.status === 'found' && publicProfile.profile.stats) {
          const publicStats = publicProfile.profile.stats;
          setStats({
            stories: publicStats.stories,
            companionships: publicStats.companionshipsReceived,
            followers: publicStats.followers,
            following: publicStats.following,
          });
        } else {
          setStats(fallback);
        }
      } catch (err) {
        console.error('Error cargando el perfil', err);
        setError('No se pudo cargar tu perfil.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
        { label: 'Mis relatos', icon: 'book', onClick: () => router.push('/mis-relatos') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
        { label: 'Ayuda y soporte', icon: 'mail', onClick: () => router.push('/soporte') },
        {
          label: 'Privacidad y configuración',
          icon: 'settings',
          onClick: () => router.push('/cuenta/configuracion'),
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
      case 'mood':
        router.push('/mi-estado');
        break;
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'profile':
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

  const name = character?.name ?? '';
  const isStaff =
    account?.role === 'MODERATOR' || account?.role === 'ADMIN' || account?.role === 'SUPERADMIN';

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
      activeRoute="profile"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen profile-page-v42">
        <section className="profile-card card">
          <div className="profile-top">
            <Avatar
              initials={initialsOf(character?.name)}
              avatarUrl={character?.avatarUrl}
              size="lg"
              alt="Tu avatar"
            />
            <div className="profile-copy">
              <h1>{name || 'Tu seudónimo'}</h1>
              <p>
                @{name ? name.toLowerCase() : 'withyouly'}
                {character?.tagline ? ` · ${character.tagline}` : ''}
              </p>
            </div>
            <div className="profile-actions">
              <button className="secondary" type="button" onClick={() => router.push('/perfil/editar')}>
                <Icon name="edit" /> Editar perfil
              </button>
              <button
                className="text-link"
                type="button"
                onClick={() => router.push(`/personaje/${encodeURIComponent(name)}`)}
              >
                Ver mi perfil público
              </button>
            </div>
          </div>

          {character?.bio ? <p className="profile-bio">{character.bio}</p> : null}

          <div className="profile-stats">
            <div className="profile-stat is-static">
              <b>{stats.stories}</b>
              <small>Relatos</small>
            </div>
            <div className="profile-stat is-static">
              <b>{stats.companionships}</b>
              <small>Personas contigo</small>
            </div>
            <button
              className="profile-stat"
              type="button"
              onClick={() => router.push(`/seguidores/${encodeURIComponent(name)}`)}
            >
              <b>{stats.followers}</b>
              <small>Seguidores</small>
            </button>
            <button
              className="profile-stat"
              type="button"
              onClick={() => router.push(`/seguidores/${encodeURIComponent(name)}?tab=following`)}
            >
              <b>{stats.following}</b>
              <small>Siguiendo</small>
            </button>
          </div>

          <button
            className="text-link follower-entry"
            type="button"
            onClick={() => router.push(`/seguidores/${encodeURIComponent(name)}`)}
          >
            Ver seguidores
          </button>
        </section>

        <section className="settings-list card">
          <button className="settings-row" type="button" onClick={() => router.push('/mis-relatos')}>
            <span>
              <Icon name="book" />
            </span>
            <span>
              <b>Mis relatos</b>
              <small>Publicaciones, borradores y guardados</small>
            </span>
            <Icon name="chevron" />
          </button>
          <button className="settings-row" type="button" onClick={() => router.push('/mi-estado')}>
            <span>
              <Icon name="pulse" />
            </span>
            <span>
              <b>Mi espacio emocional</b>
              <small>Registros, gráficas y actividades privadas</small>
            </span>
            <Icon name="chevron" />
          </button>
          <button className="settings-row" type="button" onClick={() => router.push('/mi-arbol')}>
            <span>
              <Icon name="trend" />
            </span>
            <span>
              <b>Mi árbol</b>
              <small>Tu crecimiento permanece privado</small>
            </span>
            <Icon name="chevron" />
          </button>
          <button className="settings-row" type="button" onClick={() => router.push('/cuenta/configuracion')}>
            <span>
              <Icon name="settings" />
            </span>
            <span>
              <b>Privacidad y configuración</b>
              <small>Cuenta, seudónimo y notificaciones</small>
            </span>
            <Icon name="chevron" />
          </button>
          <button className="settings-row" type="button" onClick={() => router.push('/soporte')}>
            <span>
              <Icon name="shield" />
            </span>
            <span>
              <b>Ayuda y seguridad</b>
              <small>Reportes y recursos de apoyo</small>
            </span>
            <Icon name="chevron" />
          </button>
          {isStaff ? (
            <button className="settings-row" type="button" onClick={() => router.push('/moderacion')}>
              <span>
                <Icon name="flag" />
              </span>
              <span>
                <b>Panel de moderación</b>
                <small>Reportes, apelaciones e historial</small>
              </span>
              <Icon name="chevron" />
            </button>
          ) : null}
        </section>

        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}
      </section>
    </WyFrame>
  );
}
