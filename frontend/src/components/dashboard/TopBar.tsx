'use client';

import Image from 'next/image';
import { CharacterSummary } from './types';

interface TopBarProps {
  character: CharacterSummary | null;
  onOpenSettings: () => void;
  onToggleNav: () => void;
  onLogout: () => void;
}

export default function TopBar({
  character,
  onOpenSettings,
  onToggleNav,
  onLogout,
}: TopBarProps) {
  const name = character?.name ?? '';
  const showAvatar = Boolean(character?.avatarUrl);
  const handle = name.toLowerCase().replace(/[^a-z0-9áéíóúñü]/gi, '_');

  return (
    <header className="fixed top-0 w-full h-16 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_12px_rgba(70,72,212,0.06)]">
      <div className="h-16 w-full px-gutter-mobile sm:px-gutter flex items-center justify-between gap-space-sm sm:gap-space-md">
        {/* Marca */}
        <div className="flex items-center gap-space-sm sm:gap-space-md shrink-0">
          <button
            type="button"
            onClick={onToggleNav}
            aria-label="Abrir menú de navegación"
            className="lg:hidden flex items-center justify-center w-9 h-9 -ml-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-xl">menu</span>
          </button>

          <div className="flex items-center gap-space-sm">
            <Image src="/logo.png" alt="Whityouly" width={128} height={32} className="h-8 w-auto object-contain" priority />
            </div>
          </div>

        {/* Buscador */}
        <div className="hidden md:block flex-1 max-w-xl">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-space-md text-on-surface-variant text-base">
              search
            </span>
            <input
              type="text"
              aria-label="Buscar en la comunidad"
              placeholder="Buscar relatos, emociones, reflexiones o apoyos..."
              className="w-full bg-surface-container-low hover:bg-surface-container focus:bg-surface-container-lowest text-on-surface placeholder:text-outline pl-11 pr-space-md py-2 rounded-full text-body-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-space-xs sm:gap-space-md shrink-0">
          <button
            type="button"
            aria-label="Notificaciones"
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors relative"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-tertiary" />
          </button>

          <div className="flex items-center gap-space-sm pl-space-xs">
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Mi perfil"
              className="flex items-center gap-space-sm text-left group"
            >
              <div className="relative shrink-0">
                {showAvatar ? (
                  <Image
                    src={character!.avatarUrl!}
                    alt={`Avatar de ${name}`}
                    width={32}
                    height={32}
                    // El backend ya entrega un WebP de 512 px sin metadatos y el
                    // host cambia entre desarrollo y producción, así que no
                    // pasamos la imagen por el optimizador de Next.
                    unoptimized
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-fixed text-primary flex items-center justify-center ring-2 ring-primary/20">
                    {name ? (
                      <span className="text-label-lg font-bold">{name.charAt(0).toUpperCase()}</span>
                    ) : (
                      <span className="material-symbols-outlined text-lg">account_circle</span>
                    )}
                  </div>
                )}
              </div>

              <div className="hidden lg:flex flex-col text-left">
                <span className="text-label-md text-on-surface max-w-[10rem] truncate group-hover:text-primary transition-colors">
                  {name ? `@${handle}` : 'Mi perfil'}
                </span>
                {name && (
                  <span className="text-label-sm text-secondary flex items-center gap-0.5">
                    Identidad protegida
                  </span>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={onLogout}
              aria-label="Cerrar sesión"
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
