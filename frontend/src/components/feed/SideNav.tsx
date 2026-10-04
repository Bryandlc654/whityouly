'use client';

import { EMOTIONAL_TONES, NAV_MAIN } from '@/lib/feed-data';

interface SideNavProps {
  open: boolean;
  onClose: () => void;
}

export default function SideNav({ open, onClose }: SideNavProps) {
  const content = (
    <>
      <div className="flex flex-col gap-space-md overflow-y-auto px-space-sm">
        <nav className="flex flex-col gap-1" aria-label="Navegación principal">
          <div className="px-space-sm py-1 text-label-sm text-outline uppercase tracking-wider">
            Navegación
          </div>
          {NAV_MAIN.map((item) => (
            <a
              key={item.label}
              // Las secciones que aún no existen apuntan a "#"; el Feed y la
              // configuración sí son páginas reales y deben navegar de verdad.
              href={'href' in item ? item.href : '#'}
              aria-current={'active' in item && item.active ? 'page' : undefined}
              onClick={onClose}
              className={
                'active' in item && item.active
                  ? 'flex items-center gap-space-sm px-space-md py-2.5 transition-all bg-primary-container text-on-primary-container font-semibold rounded-xl shadow-sm'
                  : 'flex items-center gap-space-sm px-space-md py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all'
              }
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span className="text-label-lg">{item.label}</span>
              {'locked' in item && item.locked && (
                <span className="material-symbols-outlined text-xs text-outline ml-auto">lock</span>
              )}
            </a>
          ))}
        </nav>

        <nav className="flex flex-col gap-1" aria-label="Sintonías emocionales">
          <div className="px-space-sm py-1 text-label-sm text-outline uppercase tracking-wider">
            Sintonías Emocionales
          </div>
          {EMOTIONAL_TONES.map((tone) => (
            <a
              key={tone.label}
              href="#"
              onClick={onClose}
              className="flex items-center gap-space-sm px-space-md py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${tone.dot}`} />
              <span className="text-body-sm">{tone.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </>
  );

  return (
    <>
      {/* Escritorio: columna fija */}
      <aside className="hidden lg:flex fixed left-0 top-16 bottom-0 w-64 bg-surface-container-low/70 backdrop-blur-md z-40 flex-col justify-between py-space-md">
        {content}
      </aside>

      {/* Móvil: cajón deslizante */}
      <div
        className={`lg:hidden fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          onClick={onClose}
          className={`absolute inset-0 bg-[#0d1c2e]/50 transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-surface-container-low shadow-2xl flex flex-col justify-between py-space-md transition-transform duration-300 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
          role="dialog"
          aria-label="Menú de navegación"
        >
          <div className="flex items-center justify-between px-space-md pb-2">
            <span className="text-headline-sm text-on-surface">Menú</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar menú"
              className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          {content}
        </aside>
      </div>
    </>
  );
}
