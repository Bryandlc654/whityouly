'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { fetchAccount, type Account } from '@/lib/account';
import { authFetch, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';

interface SettingsPageProps {
  title: string;
  copy: string;
  showBack?: boolean;
  children: (
    account: Account,
    character: CharacterSummary | null,
    reload: () => Promise<void>,
  ) => ReactNode;
}

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

export default function SettingsPage({ title, copy, showBack = true, children }: SettingsPageProps) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);

  const reload = useCallback(async () => {
    const result = await fetchAccount();
    if (result.status === 'ok') {
      setAccount(result.data);
      setError('');
    } else {
      setError(result.message);
    }
  }, []);

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace('/login');
      return;
    }

    void (async () => {
      await reload();

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
      } catch {
        /* la pÃ¡gina sigue disponible sin avatar */
      }

      setLoading(false);
    })();
  }, [reload, router]);

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
      case 'mood':
        router.push('/mi-diario');
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
      case 'profile':
        router.push('/cuenta');
        break;
      case 'help':
        router.push('/ayuda');
        break;
      default:
        break;
    }
  };

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="character"
      onNavigate={navigate}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen settings-subpage">
        {showBack ? (
          <div className="screen-back">
            <button className="ghost" type="button" onClick={() => router.push('/cuenta/configuracion')}>
              {'\u2190 Configuraci\u00f3n'}
            </button>
            <div>
              <h1>{title}</h1>
              <p>{copy}</p>
            </div>
          </div>
        ) : (
          <div className="screen-heading">
            <div>
              <h1>{title}</h1>
              <p>{copy}</p>
            </div>
          </div>
        )}

        {loading ? <p className="muted small">Cargando tus ajustesâ€¦</p> : null}

        {!loading && error && !account ? (
          <div className="auth-error" role="alert">
            {error}
            <button className="text-link" type="button" style={{ marginLeft: 8 }} onClick={() => void reload()}>
              Reintentar
            </button>
          </div>
        ) : null}

        {!loading && account ? (
          <>
            {error ? (
              <div className="auth-error" role="alert">
                {error}
              </div>
            ) : null}
            {children(account, character, reload)}
          </>
        ) : null}
      </section>
    </WyFrame>
  );
}

