'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { fetchAccount, type Account } from '@/lib/account';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import AppShell from '@/components/layout/AppShell';
import PreferencesSection from '@/components/account/PreferencesSection';
import SecuritySection from '@/components/account/SecuritySection';
import FilesSection from '@/components/account/FilesSection';
import DeleteAccountSection from '@/components/account/DeleteAccountSection';

type Tab = 'preferencias' | 'seguridad' | 'archivos' | 'baja';

const TABS: { id: Tab; label: string }[] = [
  { id: 'preferencias', label: 'Preferencias' },
  { id: 'seguridad', label: 'Seguridad' },
  { id: 'archivos', label: 'Archivos' },
  { id: 'baja', label: 'Baja' },
];

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [tab, setTab] = useState<Tab>('preferencias');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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

  // La barra superior muestra la identidad seudónima, que vive en /characters.
  // Si no hay personaje todavía, el avatar cae al marcador y el perfil abre el
  // Feed, que es donde se crea.
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
      } catch (error) {
        console.error('Error cargando personaje', error);
      }
    };

    void loadCharacter();
  }, [router]);

  const logout = async () => {
    await endSession();
    router.push('/login');
  };

  return (
    <AppShell character={character} onLogout={logout}>
      <div className="mx-auto w-full max-w-3xl pt-space-md">
        <header className="mb-6">
          <h1 className="text-headline-sm font-semibold">Configuración de la cuenta</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {account
              ? `${account.email} · ${account.activeSessions} ${
                  account.activeSessions === 1 ? 'sesión activa' : 'sesiones activas'
                }`
              : 'Cargando tus datos…'}
          </p>
        </header>

        {loading && <p className="text-body-md text-on-surface-variant">Cargando…</p>}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-body-sm"
          >
            {error}
            <button
              type="button"
              onClick={() => void load()}
              className="ml-3 underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && account && (
          <>
            <nav aria-label="Secciones de la cuenta" className="mb-6 flex flex-wrap gap-1">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? 'page' : undefined}
                  className={
                    tab === id
                      ? 'px-space-md py-1.5 rounded-full text-label-md font-medium bg-primary-container text-on-primary-container'
                      : 'px-space-md py-1.5 rounded-full text-label-md font-medium text-on-surface-variant hover:bg-surface-container'
                  }
                >
                  {label}
                </button>
              ))}
            </nav>

            {tab === 'preferencias' && (
              <PreferencesSection account={account} onSaved={setAccount} />
            )}
            {tab === 'seguridad' && <SecuritySection account={account} />}
            {tab === 'archivos' && <FilesSection usage={account.usage} />}
            {tab === 'baja' && <DeleteAccountSection />}
          </>
        )}
      </div>
    </AppShell>
  );
}
