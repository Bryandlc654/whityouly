'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import Icon from './Icon';
import type { IconName } from './icons';
import HeaderSearch from './HeaderSearch';
import NotificationsMenu from './NotificationsMenu';
import StoryViewer from './StoryViewer';

export type WyRoute =
  | 'home'
  | 'explore'
  | 'my-stories'
  | 'following'
  | 'mood'
  | 'pulso'
  | 'tree'
  | 'profile'
  | 'character'
  | 'help'
  | 'notifications';

const NAV: { label: string; icon: IconName; route: WyRoute }[] = [
  { label: 'Inicio', icon: 'home', route: 'home' },
  { label: 'Explorar', icon: 'search', route: 'explore' },
  { label: 'Mis relatos', icon: 'book', route: 'my-stories' },
  { label: 'Siguiendo', icon: 'users', route: 'following' },
  { label: 'Mi espacio', icon: 'pulse', route: 'mood' },
  { label: 'Perfil', icon: 'user', route: 'profile' },
];

interface FrameProps {
  characterInitials: string;
  avatarUrl?: string | null;
  activeRoute: WyRoute;
  onNavigate: (route: WyRoute) => void;
  onOpenAccount?: () => void;
  rightRail: ReactNode;
  overlay?: ReactNode;
  sheet?: ReactNode;
  toast?: string;
  unreadNotifications?: number;
  /** Clase extra para variantes visuales acotadas (por ejemplo, feed v42). */
  className?: string;
  children: ReactNode;
}

function TopBar({
  characterInitials,
  avatarUrl,
  onNavigate,
  onOpenStory,
  unreadNotifications = 0,
}: Pick<
  FrameProps,
  'characterInitials' | 'avatarUrl' | 'onNavigate' | 'unreadNotifications'
> & { onOpenStory: (storyId: string, title: string) => void }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" type="button" onClick={() => onNavigate('home')} aria-label="Ir al inicio">
          <span className="brand-crop" role="img" aria-label="Withyouly" />
        </button>
        <HeaderSearch onOpenStory={onOpenStory} />
        <div className="top-actions">
          <button
            className="icon-btn"
            type="button"
            onClick={() => onNavigate('help')}
            aria-label="Ayuda y seguridad"
          >
            <span data-icon="help"><Icon name="help" /></span>
          </button>
          <NotificationsMenu unreadCount={unreadNotifications} />
          <button
            className={avatarUrl ? 'avatar avatar-art avatar-sm avatar-illustrated' : 'avatar avatar-sm'}
            type="button"
            onClick={() => onNavigate('profile')}
            aria-label="Mi perfil"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" width={96} height={96} unoptimized draggable={false} />
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
            <span data-icon={item.icon}><Icon name={item.icon} /></span>
            <b>{item.label}</b>
          </button>
        ))}
      </nav>
      <div className="safety-note">
        <span data-icon="shield">
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
}: Pick<FrameProps, 'activeRoute' | 'onNavigate'>) {
  return (
    <nav className="bottom-nav" aria-label="Navegación móvil">
      <button
        type="button"
        className={activeRoute === 'home' ? 'active' : undefined}
        onClick={() => onNavigate('home')}
      >
        <span data-icon="home"><Icon name="home" /></span>
        <small>Inicio</small>
      </button>
      <button
        type="button"
        className={activeRoute === 'explore' ? 'active' : undefined}
        onClick={() => onNavigate('explore')}
      >
        <span data-icon="search"><Icon name="search" /></span>
        <small>Explorar</small>
      </button>
      <button className="create-fab" type="button" onClick={() => onNavigate('my-stories')} aria-label="Compartir relato">
        <span data-icon="plus"><Icon name="plus" /></span>
      </button>
      <button
        type="button"
        className={activeRoute === 'mood' ? 'active' : undefined}
        onClick={() => onNavigate('mood')}
      >
        <span data-icon="pulse"><Icon name="pulse" /></span>
        <small>Mi espacio</small>
      </button>
      <button
        type="button"
        className={activeRoute === 'profile' ? 'active' : undefined}
        onClick={() => onNavigate('profile')}
      >
        <span data-icon="user"><Icon name="user" /></span>
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
  rightRail,
  overlay,
  sheet,
  toast,
  unreadNotifications = 0,
  className,
  children,
}: FrameProps) {
  const [searchReader, setSearchReader] = useState<{ id: string; title: string } | null>(null);

  return (
    <div className={`wy feed-reference${className ? ` ${className}` : ''}`}>
      <TopBar
        characterInitials={characterInitials}
        avatarUrl={avatarUrl}
        onNavigate={onNavigate}
        onOpenStory={(storyId, title) => setSearchReader({ id: storyId, title })}
        unreadNotifications={unreadNotifications}
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
      <BottomNav activeRoute={activeRoute} onNavigate={onNavigate} />
      {searchReader ? (
        <div className="modal-layer">
          <StoryViewer
            storyId={searchReader.id}
            title={searchReader.title}
            onClose={() => setSearchReader(null)}
          />
        </div>
      ) : null}
      {overlay ? <div className="modal-layer">{overlay}</div> : null}
      {sheet ? <div className="sheet-layer">{sheet}</div> : null}
      <div className={`toast ${toast ? 'show' : ''}`} role="status">
        {toast}
      </div>
    </div>
  );
}
