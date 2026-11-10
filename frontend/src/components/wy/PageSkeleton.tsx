import Icon from './Icon';
import type { IconName } from './icons';

/**
 * Pantalla de carga con la misma geometría que WyFrame: barra superior, menú
 * lateral, contenido y riel derecho. Sustituye al antiguo «Verificando acceso…»
 * para que la página aparezca al instante y el contenido se vaya revelando.
 * Es estática (sin peticiones) y se marca como `aria-busy` para lectores de pantalla.
 */

export type SkeletonVariant = 'feed' | 'list' | 'grid' | 'detail' | 'form';

const NAV: { label: string; icon: IconName }[] = [
  { label: 'Inicio', icon: 'home' },
  { label: 'Explorar', icon: 'search' },
  { label: 'Mis relatos', icon: 'book' },
  { label: 'Siguiendo', icon: 'users' },
  { label: 'Mi espacio', icon: 'pulse' },
  { label: 'Perfil', icon: 'user' },
];

function Bone({ w, h = 12, r, className }: { w?: number | string; h?: number; r?: number; className?: string }) {
  return (
    <span
      className={`sk-bone${className ? ` ${className}` : ''}`}
      style={{ width: w ?? '100%', height: h, borderRadius: r }}
      aria-hidden
    />
  );
}

/** Tarjeta de relato del feed (cabecera con avatar, título, texto y acciones). */
export function SkeletonPost() {
  return (
    <div className="sk-card sk-post" aria-hidden>
      <div className="sk-row">
        <Bone w={40} h={40} r={999} />
        <div className="sk-stack" style={{ flex: 1 }}>
          <Bone w="38%" h={12} />
          <Bone w="22%" h={10} />
        </div>
      </div>
      <Bone w={92} h={20} r={999} />
      <Bone w="70%" h={18} />
      <div className="sk-stack">
        <Bone />
        <Bone />
        <Bone w="62%" />
      </div>
      <div className="sk-actions">
        <Bone w="18%" h={14} />
        <Bone w="18%" h={14} />
        <Bone w="18%" h={14} />
        <Bone w="18%" h={14} />
      </div>
    </div>
  );
}

/** Fila de lista (Mis relatos, Siguiendo, Notificaciones…). */
export function SkeletonRow() {
  return (
    <div className="sk-card sk-list-row" aria-hidden>
      <div className="sk-stack" style={{ flex: 1 }}>
        <Bone w={84} h={18} r={999} />
        <Bone w="64%" h={14} />
        <Bone w="34%" h={10} />
      </div>
      <Bone w={118} h={34} r={11} />
    </div>
  );
}

/** Lista de N elementos para cargas dentro de una página ya visible. */
export function SkeletonList({ count = 3, kind = 'row' }: { count?: number; kind?: 'row' | 'post' }) {
  return (
    <div className="sk-list" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: count }, (_, index) =>
        kind === 'post' ? <SkeletonPost key={index} /> : <SkeletonRow key={index} />,
      )}
    </div>
  );
}

function MainContent({ variant }: { variant: SkeletonVariant }) {
  const heading = (
    <div className="sk-heading">
      <div className="sk-stack" style={{ flex: 1 }}>
        <Bone w="42%" h={28} r={10} />
        <Bone w="64%" h={12} />
      </div>
      {variant !== 'detail' ? <Bone w={110} h={36} r={12} /> : null}
    </div>
  );

  if (variant === 'feed') {
    return (
      <>
        {heading}
        <div className="sk-card sk-checkin">
          <Bone w="34%" h={16} />
          <div className="sk-chips">
            {Array.from({ length: 6 }, (_, index) => (
              <Bone key={index} h={62} r={15} />
            ))}
          </div>
        </div>
        <Bone h={54} r={999} />
        <SkeletonPost />
        <SkeletonPost />
      </>
    );
  }

  if (variant === 'grid') {
    return (
      <>
        {heading}
        <Bone h={46} r={14} />
        <div className="sk-chips sk-pills">
          {Array.from({ length: 5 }, (_, index) => (
            <Bone key={index} w={86} h={34} r={999} />
          ))}
        </div>
        <div className="sk-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="sk-card sk-tile">
              <Bone w={28} h={28} r={8} />
              <Bone w="56%" h={14} />
              <Bone w="88%" h={10} />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (variant === 'detail') {
    return (
      <>
        <Bone w={110} h={14} />
        {heading}
        <SkeletonPost />
        <div className="sk-card sk-stack">
          <Bone w="30%" h={14} />
          <Bone />
          <Bone w="80%" />
        </div>
      </>
    );
  }

  if (variant === 'form') {
    return (
      <>
        {heading}
        <div className="sk-card sk-stack sk-form">
          <Bone w={150} h={24} r={999} />
          <Bone w={60} h={12} />
          <Bone h={44} r={12} />
          <Bone w={80} h={12} />
          <Bone h={140} r={12} />
          <Bone w="40%" h={12} />
          <div className="sk-row">
            <Bone h={44} r={12} />
            <Bone h={44} r={12} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {heading}
      <Bone h={46} r={14} />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </>
  );
}

export default function PageSkeleton({ variant = 'list' }: { variant?: SkeletonVariant }) {
  return (
    <div className="wy feed-reference sk-page" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando Withyouly…</span>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="brand-crop" role="img" aria-label="Withyouly" />
          </span>
          <Bone className="sk-search" h={40} r={999} />
          <div className="top-actions">
            <Bone w={36} h={36} r={999} />
            <Bone w={36} h={36} r={999} />
            <Bone w={40} h={40} r={999} />
          </div>
        </div>
      </header>
      <div className="app-shell">
        <aside className="left-rail" aria-hidden>
          <nav className="side-nav">
            {NAV.map((item) => (
              <span key={item.label} className="sk-nav-item">
                <span data-icon={item.icon}>
                  <Icon name={item.icon} />
                </span>
                <b>{item.label}</b>
              </span>
            ))}
          </nav>
          <div className="safety-note sk-card sk-stack">
            <Bone w="70%" h={14} />
            <Bone w="90%" h={10} />
            <Bone w="50%" h={10} />
          </div>
        </aside>
        <main className="main-content sk-main" aria-hidden>
          <MainContent variant={variant} />
        </main>
        <aside className="right-rail" aria-hidden>
          <div className="sk-card sk-stack">
            <Bone w="66%" h={16} />
            <Bone h={70} r={10} />
            <Bone w="44%" h={12} />
          </div>
          <div className="sk-card sk-stack">
            <Bone w="40%" h={16} />
            <div className="sk-row">
              <Bone w={52} h={52} r={14} />
              <div className="sk-stack" style={{ flex: 1 }}>
                <Bone w="60%" h={12} />
                <Bone w="90%" h={10} />
              </div>
            </div>
            <Bone w="58%" h={36} r={12} />
          </div>
        </aside>
      </div>
    </div>
  );
}
