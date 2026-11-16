import Link from 'next/link';
import type { ReactNode } from 'react';
import LanguageSwitcher from './LanguageSwitcher';

interface AuthCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  image?: string;
  imageAlt?: string;
  /** Texto superpuesto a la imagen en la variante `reference` (la foto ya no lo trae). */
  imageCaption?: ReactNode;
  /** Layout de acceso limpio: formulario y panel informativo lateral. */
  variant?: 'default' | 'reference';
}

/**
 * Tarjeta del prototipo para las pantallas sin sesión
 * (login, registro, recuperación y verificación).
 *
 * `variant="reference"` reproduce el acceso de dos paneles: formulario
 * minimalista a la izquierda y panel informativo suave a la derecha.
 */
export default function AuthCard({
  title,
  subtitle,
  children,
  image,
  imageAlt,
  imageCaption,
  variant = 'default',
}: AuthCardProps) {
  if (variant === 'reference') {
    return (
      <div className="wy">
        <div className="auth-lang">
          <LanguageSwitcher compact />
        </div>
        <section className="login-shell">
          <div className="login-panel">
            <div className="login-panel-inner">
              <Link href="/" className="login-brand" aria-label="Inicio de Withyouly">
                {/* Wordmark transparente: el recorte de .brand-crop corta los bordes. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/withyouly-wordmark.webp" alt="" width={920} height={211} />
              </Link>

              {children}
            </div>
          </div>

          <aside className="login-aside" aria-label={imageAlt}>
            <div className="login-aside-inner">{imageCaption}</div>
          </aside>
        </section>
      </div>
    );
  }

  const card = (
    <div className="auth-card card">
      <div className="auth-lang auth-lang-inline">
        <LanguageSwitcher compact />
      </div>
      <div className="auth-logo" role="img" aria-label="Withyouly" />
      {title ? <h1>{title}</h1> : null}
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </div>
  );

  if (image) {
    return (
      <div className="wy">
        <section className="auth-screen auth-split">
          <div className="auth-pane">{card}</div>
          <div
            className="auth-media"
            role="img"
            aria-label={imageAlt ?? ''}
            style={{ backgroundImage: `url('${image}')` }}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="wy">
      <section className="auth-screen">{card}</section>
    </div>
  );
}
