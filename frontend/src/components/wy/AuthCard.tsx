import type { ReactNode } from 'react';

interface AuthCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Tarjeta centrada del prototipo para las pantallas sin sesión
 * (login, registro, recuperación y verificación).
 */
export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="wy">
      <section className="auth-screen">
        <div className="auth-card card">
          <div className="auth-logo" role="img" aria-label="Withyouly" />
          {title ? <h1>{title}</h1> : null}
          {subtitle ? <p>{subtitle}</p> : null}
          {children}
        </div>
      </section>
    </div>
  );
}
