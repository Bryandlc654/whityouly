import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import Icon from './Icon';

interface AuthCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  image?: string;
  imageAlt?: string;
  /** Layout de acceso de la referencia v42: panel + imagen y bloque de confianza. */
  variant?: 'default' | 'reference';
  showTrust?: boolean;
}

const TRUST = [
  {
    icon: 'shield' as const,
    title: 'Identidad seudónima',
    text: 'Tu correo nunca se muestra. Creas un perfil público con un seudónimo único, sin exponer quién eres.',
  },
  {
    icon: 'lock' as const,
    title: 'Sesiones bajo tu control',
    text: 'Revisa cada dispositivo con acceso a tu cuenta y cierra cualquier sesión cuando lo necesites.',
  },
  {
    icon: 'eye' as const,
    title: 'Privacidad granular',
    text: 'Decides qué actividad se muestra en tu perfil y qué información permanece completamente privada.',
  },
  {
    icon: 'user' as const,
    title: 'Avatar protegido',
    text: 'Puedes usar un avatar ilustrado. No necesitas publicar una fotografía real para participar.',
  },
];

/**
 * Tarjeta del prototipo para las pantallas sin sesión
 * (login, registro, recuperación y verificación).
 *
 * `variant="reference"` reproduce la portada de acceso aprobada en v42: panel
 * de formulario a la izquierda, imagen de comunidad a la derecha y bloque de
 * privacidad debajo.
 */
export default function AuthCard({
  title,
  subtitle,
  children,
  image,
  imageAlt,
  variant = 'default',
  showTrust = false,
}: AuthCardProps) {
  if (variant === 'reference' && image) {
    return (
      <div className="wy">
        <section className="reference-entry">
          <div className="reference-login-panel">
            <div className="reference-panel-inner">
              <Link href="/" className="reference-logo" aria-label="Ir a la portada de Withyouly">
                <Image src="/withyouly-logo.png" alt="Withyouly" width={380} height={95} priority />
              </Link>

              <div className="reference-form">
                {title ? <h1>{title}</h1> : null}
                {subtitle ? <p>{subtitle}</p> : null}
                {children}
              </div>
            </div>
          </div>

          <div
            className="reference-visual"
            role="img"
            aria-label={imageAlt ?? 'Comunidad de Withyouly'}
            style={{ backgroundImage: `url('${image}')` }}
          />
        </section>

        {showTrust ? (
          <section className="reference-trust" aria-labelledby="trust-title">
            <div className="trust-heading">
              <span className="eyebrow">PRIVACIDAD DISEÑADA DESDE EL INICIO</span>
              <h2 id="trust-title">Tu espacio, tu identidad y tus decisiones</h2>
              <p>Cuatro principios que protegen tu participación en Withyouly.</p>
            </div>
            <div className="trust-grid">
              {TRUST.map((item) => (
                <article key={item.title}>
                  <span className="trust-icon">
                    <Icon name={item.icon} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  const card = (
    <div className="auth-card card">
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
