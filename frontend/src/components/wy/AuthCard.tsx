import type { ReactNode } from 'react';

interface AuthCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  image?: string;
  imageAlt?: string;
}

/**
 * Tarjeta del prototipo para las pantallas sin sesión
 * (login, registro, recuperación y verificación).
 *
 * Cuando se pasa `image`, la pantalla se divide en dos columnas:
 * 40% para el formulario y 60% para la imagen de fondo.
 */
export default function AuthCard({ title, subtitle, children, image, imageAlt }: AuthCardProps) {
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
