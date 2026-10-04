'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import { FEED_STORIES, ONLINE_COUNT } from '@/lib/feed-data';
import CharacterDialog from '@/components/feed/CharacterDialog';
import Composer from '@/components/feed/Composer';
import FeedFilters from '@/components/feed/FeedFilters';
import IdentityCard from '@/components/feed/IdentityCard';
import MoodSelector from '@/components/feed/MoodSelector';
import QuestionOfTheDay from '@/components/feed/QuestionOfTheDay';
import RightColumn from '@/components/feed/RightColumn';
import SideNav from '@/components/feed/SideNav';
import StoryCard from '@/components/feed/StoryCard';
import TopBar from '@/components/feed/TopBar';
import { CharacterSummary, SessionInfo } from '@/components/feed/types';

export default function FeedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState('');

  const loadSessions = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/auth/sessions`);
      if (res.ok) {
        setSessions(await res.json());
      }
    } catch (error) {
      console.error('Error cargando sesiones', error);
    }
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      const token = tokenStorage.getAccess();

      // Sin token ni siquiera lo intentamos: directo al login.
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        // authFetch renueva el access token automáticamente si expiró.
        const res = await authFetch(`${API_URL}/characters/me`);

        if (res.status === 401) {
          tokenStorage.clear();
          router.push('/login');
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (data) {
            setCharacter(data);
            // Sin personaje no hay seudónimo: la identidad es lo primero.
            setDialogOpen(!data);
          }
        }
      } catch (error) {
        console.error('Error verificando sesión', error);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const logout = async () => {
    await endSession();
    router.push('/login');
  };

  const revokeSession = async (session: SessionInfo) => {
    const res = await authFetch(`${API_URL}/auth/sessions/${session.id}`, { method: 'DELETE' });

    if (res.ok && session.current) {
      // El usuario acaba de cerrar su propia sesión actual.
      tokenStorage.clear();
      router.push('/login');
      return;
    }

    await loadSessions();
  };

  const revokeOtherSessions = async () => {
    await authFetch(`${API_URL}/auth/sessions/revoke-others`, { method: 'POST' });
    await loadSessions();
    setToast('Se cerraron todas las demás sesiones.');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">
            progress_activity
          </span>
          <p className="text-on-surface-variant font-medium">Verificando acceso seguro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased">
      <TopBar
        character={character}
        onOpenSettings={() => setDialogOpen(true)}
        onToggleNav={() => setNavOpen((value) => !value)}
        onLogout={logout}
      />

      <SideNav open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="lg:pl-64">
        <main className="w-full min-h-[calc(100vh-4rem)] pt-16 px-gutter-mobile sm:px-gutter pb-space-xl">
          <div className="flex flex-col w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg max-w-7xl mx-auto w-full">
              {/* Feed principal */}
              <div className="lg:col-span-8 flex flex-col gap-space-md">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-space-xs pb-space-xs">
                  <div>
                    <h1 className="text-display-lg text-on-surface tracking-tight">Historias para ti</h1>
                    <p className="text-body-md text-on-surface-variant mt-0.5">
                      Lee sin juzgar. Responde desde el corazón y la propia vivencia.
                    </p>
                  </div>
                  <div className="flex items-center gap-space-xs self-start sm:self-auto bg-surface-container text-on-surface-variant px-space-sm py-1 rounded-full shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                    <span className="text-label-sm">{ONLINE_COUNT} almas conectadas en calma</span>
                  </div>
                </div>

                {!character && <IdentityCard onEdit={() => setDialogOpen(true)} />}

                <MoodSelector />

                <Composer character={character} onNeedCharacter={() => setDialogOpen(true)} />

                <FeedFilters />

                {FEED_STORIES.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}

                <QuestionOfTheDay />

                <div className="py-space-md flex flex-col items-center justify-center gap-space-xs text-center">
                  <button
                    type="button"
                    className="bg-surface-container-low hover:bg-surface-container text-on-surface text-label-lg px-space-xl py-2.5 rounded-full shadow-sm transition-all hover:scale-[1.01] flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base text-primary">
                      filter_drama
                    </span>
                    <span>Desplegar más historias con calma</span>
                  </button>
                  <span className="text-body-sm text-outline">
                    Sin algoritmos de aceleración ni desplazamiento infinito compulsivo.
                  </span>
                </div>
              </div>

              {/* Columna lateral */}
              <RightColumn
                onFollow={(name) => setToast(`Acompañar a ${name} llega con el módulo de comunidad.`)}
              />
            </div>
          </div>
        </main>

        <footer className="w-full bg-surface-container-lowest/80 backdrop-blur-sm py-space-md px-gutter-mobile sm:px-gutter flex flex-col sm:flex-row items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm text-on-surface-variant text-body-sm">
            <span className="material-symbols-outlined text-secondary text-sm">favorite</span>
            <span className="text-center sm:text-left">
              Withyouly • Comunidad de acompañamiento humano y respeto incondicional.
            </span>
          </div>
          <div className="flex items-center gap-space-md">
            <a href="#" className="text-label-sm text-outline hover:text-on-surface transition-colors">
              Protocolos éticos
            </a>
            <a
              href="#"
              className="text-label-sm text-primary hover:underline transition-all"
            >
              Recursos de Salud Mental
            </a>
          </div>
        </footer>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] bg-inverse-surface text-inverse-on-surface text-body-sm px-space-md py-2.5 rounded-full shadow-xl flex items-center gap-2 max-w-[92vw]"
        >
          <span className="material-symbols-outlined text-base">info</span>
          {toast}
        </div>
      )}

      {dialogOpen && (
        <CharacterDialog
          character={character}
          sessions={sessions}
          onClose={() => setDialogOpen(false)}
          onCharacterChange={setCharacter}
          onLoadSessions={loadSessions}
          onRevokeSession={revokeSession}
          onRevokeOthers={revokeOtherSessions}
          onLogout={logout}
        />
      )}
    </div>
  );
}
