'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/feed/TopBar';
import SideNav from '@/components/feed/SideNav';
import type { CharacterSummary } from '@/components/feed/types';

interface AppShellProps {
  /** Identidad que muestra la barra superior. */
  character: CharacterSummary | null;
  onLogout: () => void;
  /**
   * Qué hace el botón de avatar. Por defecto lleva al perfil público, que es lo
   * que espera la persona que ya no está en la página de su propio personaje.
   */
  onOpenProfile?: () => void;
  /** Aviso efímero abajo del todo. */
  toast?: string;
  /** Diálogos que se abren encima del shell, como el de identidad. */
  overlays?: ReactNode;
  children: ReactNode;
}

/**
 * Cromo común a las páginas con sesión iniciada: barra superior, menú lateral
 * (fijo en escritorio y cajón en móvil), hueco para el contenido, pie y avisos.
 *
 * Existe para que la navegación no se duplique página a página: cualquier
 * entrada nueva hereda el mismo menú y el mismo comportamiento móvil.
 */
export default function AppShell({
  character,
  onLogout,
  onOpenProfile,
  toast,
  overlays,
  children,
}: AppShellProps) {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const openProfile = () => {
    if (onOpenProfile) {
      onOpenProfile();
      return;
    }

    if (character?.name) {
      router.push(`/personaje/${character.name}`);
      return;
    }

    router.push('/feed');
  };

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased">
      <TopBar
        character={character}
        onOpenSettings={openProfile}
        onToggleNav={() => setNavOpen((value) => !value)}
        onLogout={onLogout}
      />

      <SideNav open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="lg:pl-64">
        <main className="w-full min-h-[calc(100vh-4rem)] pt-16 px-gutter-mobile sm:px-gutter pb-space-xl">
          {children}
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

      {overlays}
    </div>
  );
}
