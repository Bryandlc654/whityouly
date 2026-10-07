'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import Icon from './Icon';
import type { IconName } from './icons';

export type WyRoute =
  | 'home'
  | 'explore'
  | 'my-stories'
  | 'following'
  | 'mood'
  | 'profile'
  | 'help'
  | 'notifications';

const NAV: { label: string; icon: IconName; route: WyRoute }[] = [
  { label: 'Inicio', icon: 'home', route: 'home' },
  { label: 'Explorar', icon: 'search', route: 'explore' },
  { label: 'Mis relatos', icon: 'book', route: 'my-stories' },
  { label: 'Siguiendo', icon: 'users', route: 'following' },
  { label: 'Mi estado', icon: 'pulse', route: 'mood' },
  { label: 'Perfil', icon: 'user', route: 'profile' },
];

interface FrameProps {
  characterInitials: string;
  avatarUrl?: string | null;
  activeRoute: WyRoute;
  onNavigate: (route: WyRoute) => void;
  onOpenAccount: () => void;
  onSearch: () => void;
  rightRail: ReactNode;
  overlay?: ReactNode;
  sheet?: ReactNode;
  toast?: string;
  children: ReactNode;
}

function TopBar({
  characterInitials,
  avatarUrl,
  onNavigate,
  onOpenAccount,
  onSearch,
}: Pick<
  FrameProps,
  'characterInitials' | 'avatarUrl' | 'onNavigate' | 'onOpenAccount' | 'onSearch'
>) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" type="button" onClick={() => onNavigate('home')} aria-label="Ir al inicio">
          <span className="brand-crop" role="img" aria-label="Withyouly" />
        </button>
        <button className="searchbox" type="button" onClick={onSearch} aria-label="Buscar">
          <Icon name="search" />
          <span>Buscar relatos, emociones o seudónimos</span>
        </button>
        <div className="top-actions">
          <button
            className="icon-btn"
            type="button"
            onClick={() => onNavigate('help')}
            aria-label="Ayuda y seguridad"
          >
            <Icon name="help" />
          </button>
          <button
            className="icon-btn has-dot"
            type="button"
            onClick={() => onNavigate('notifications')}
            aria-label="Notificaciones"
          >
            <Icon name="bell" />
          </button>
          <button
            className="avatar avatar-sm"
            type="button"
            onClick={onOpenAccount}
            aria-label="Mi cuenta"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" width={42} height={42} unoptimized />
            ) : (
              characterInitials
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

function LeftRail({
  activeRoute,
  onNavigate,
}: Pick<FrameProps, 'activeRoute' | 'onNavigate'>) {
  return (
    <aside className="left-rail" aria-label="Navegación principal">
      <nav className="side-nav">
        {NAV.map((item) => (
          <button
            key={item.route}
            type="button"
            className={activeRoute === item.route ? 'active' : undefined}
            aria-current={activeRoute === item.route ? 'page' : undefined}
            onClick={() => onNavigate(item.route)}
          >
            <Icon name={item.icon} />
            <b>{item.label}</b>
          </button>
        ))}
      </nav>
      <button className="primary wide" type="button" onClick={() => onNavigate('my-stories')}>
        <Icon name="plus" />
        <span>Compartir relato</span>
      </button>
      <div className="safety-note">
        <span>
          <Icon name="shield" />
        </span>
        <div>
          <b>Tu bienestar importa</b>
          <small>Ayuda, privacidad y recursos de apoyo.</small>
        </div>
        <button type="button" onClick={() => onNavigate('help')}>
          Ver recursos
        </button>
      </div>
    </aside>
  );
}

function BottomNav({
  activeRoute,
  onNavigate,
  onOpenAccount,
}: Pick<FrameProps, 'activeRoute' | 'onNavigate' | 'onOpenAccount'>) {
  return (
    <nav className="bottom-nav" aria-label="Navegación móvil">
      <button
        type="button"
        className={activeRoute === 'home' ? 'active' : undefined}
        onClick={() => onNavigate('home')}
      >
        <Icon name="home" />
        <small>Inicio</small>
      </button>
      <button type="button" onClick={() => onNavigate('explore')}>
        <Icon name="search" />
        <small>Explorar</small>
      </button>
      <button className="create-fab" type="button" onClick={() => onNavigate('my-stories')} aria-label="Compartir relato">
        <Icon name="plus" />
      </button>
      <button type="button" onClick={() => onNavigate('mood')}>
        <Icon name="pulse" />
        <small>Mi estado</small>
      </button>
      <button type="button" onClick={onOpenAccount}>
        <Icon name="user" />
        <small>Perfil</small>
      </button>
    </nav>
  );
}

export default function WyFrame({
  characterInitials,
  avatarUrl,
  activeRoute,
  onNavigate,
  onOpenAccount,
  onSearch,
  rightRail,
  overlay,
  sheet,
  toast,
  children,
}: FrameProps) {
  return (
    <div className="wy">
      <TopBar
        characterInitials={characterInitials}
        avatarUrl={avatarUrl}
        onNavigate={onNavigate}
        onOpenAccount={onOpenAccount}
        onSearch={onSearch}
      />
      <div className="app-shell">
        <LeftRail activeRoute={activeRoute} onNavigate={onNavigate} />
        <main className="main-content" id="main">
          {children}
        </main>
        <aside className="right-rail" aria-label="Información complementaria">
          {rightRail}
        </aside>
      </div>
      <BottomNav activeRoute={activeRoute} onNavigate={onNavigate} onOpenAccount={onOpenAccount} />
      {overlay ? <div className="modal-layer">{overlay}</div> : null}
      {sheet ? <div className="sheet-layer">{sheet}</div> : null}
      <div className={`toast ${toast ? 'show' : ''}`} role="status">
        {toast}
      </div>
    </div>
  );
}
