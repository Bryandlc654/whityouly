'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { fetchAccount, type Account } from '@/lib/account';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';
import type { IconName } from '@/components/wy/icons';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import PreferencesSection from '@/components/account/PreferencesSection';
import SecuritySection from '@/components/account/SecuritySection';
import PrivacySection from '@/components/account/PrivacySection';
import FilesSection from '@/components/account/FilesSection';
import DeleteAccountSection from '@/components/account/DeleteAccountSection';

type Tab = 'preferencias' | 'seguridad' | 'privacidad' | 'archivos' | 'baja';

const TABS: { id: Tab; label: string; icon: IconName; danger?: boolean }[] = [
  { id: 'preferencias', label: 'Preferencias', icon: 'settings' },
  { id: 'seguridad', label: 'Seguridad', icon: 'shield' },
  { id: 'privacidad', label: 'Privacidad', icon: 'lock' },
  { id: 'archivos', label: 'Archivos', icon: 'book' },
  { id: 'baja', label: 'Baja', icon: 'trash', danger: true },
];

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [tab, setTab] = useState<Tab>('preferencias');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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

  const load = useCallback(async () => {
    const result = await fetchAccount();
    if (result.status === 'ok') {
      setAccount(result.data);
      setError('');
    } else {
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace('/login');
      return;
    }
    void load();
  }, [load, router]);

  useEffect(() => {
    const loadCharacter = async () => {
      try {
        const res = await authFetch(`${API_URL}/characters/me`);

        if (res.status === 401) {
          tokenStorage.clear();
          router.replace('/login');
          return;
        }

        if (res.ok) {
          setCharacter(await res.json());
        }
      } catch (err) {
        console.error('Error cargando personaje', err);
      }
    };

    void loadCharacter();
  }, [router]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Ir al Feed', icon: 'home', onClick: () => router.push('/feed') },
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
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const name = character?.name ?? '';

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
          onDaily={() => notify('La consigna diaria llega con el módulo de historias.')}
          onCategory={(category) => notify(`Explorar «${category}» llega pronto.`)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen account">
        <div className="card account-hero">
          <Avatar initials={initialsOf(character?.name)} avatarUrl={character?.avatarUrl} size="lg" />
          <div className="account-hero-info">
            <h1>Hola, {name || 'tu seudónimo'}</h1>
            <p>{account ? account.email : loading ? 'Cargando tus datos…' : 'No se pudieron cargar tus datos.'}</p>
            {account ? (
              <span className={`account-verified ${account.isEmailVerified ? 'ok' : 'muted-flag'}`}>
                <Icon name={account.isEmailVerified ? 'check' : 'lock'} />
                {account.isEmailVerified ? 'Correo verificado' : 'Correo sin verificar'}
              </span>
            ) : null}
          </div>
          {account ? (
            <div className="account-hero-badges">
              <span className="account-badge">
                <Icon name="lock" />
                {account.activeSessions}{' '}
                {account.activeSessions === 1 ? 'sesión activa' : 'sesiones activas'}
              </span>
            </div>
          ) : null}
        </div>

        {!loading && error ? (
          <div className="auth-error" role="alert">
            {error}
            <button className="text-link" type="button" onClick={() => void load()} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        ) : null}

        {!loading && account ? (
          <>
            <div className="account-tabs" role="tablist">
              {TABS.map(({ id, label, icon, danger }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`${tab === id ? 'active' : ''} ${danger ? 'danger-toggle' : ''}`.trim()}
                  onClick={() => setTab(id)}
                >
                  <Icon name={icon} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {tab === 'preferencias' && <PreferencesSection account={account} onSaved={setAccount} />}
            {tab === 'seguridad' && <SecuritySection account={account} />}
            {tab === 'privacidad' && (
              <PrivacySection
                settings={character?.privacySettings}
                onSaved={(settings) =>
                  setCharacter((prev) => (prev ? { ...prev, privacySettings: settings } : prev))
                }
              />
            )}
            {tab === 'archivos' && <FilesSection usage={account.usage} />}
            {tab === 'baja' && <DeleteAccountSection />}

            <p className="account-note">
              Tu correo se usa solo para iniciar sesión y recuperar la cuenta: nunca aparece en tu
              perfil público. La comunidad ve únicamente tu seudónimo{name ? ` ${name}` : ''}.
            </p>
          </>
        ) : null}
      </section>
    </WyFrame>
  );
}
