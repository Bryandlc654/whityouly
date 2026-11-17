'use client';

import { useEffect, useState } from 'react';
import { listAuthorPreferences } from '@/lib/contentPreferences';
import { tokenStorage } from '@/lib/auth';
import Icon from '@/components/wy/Icon';

/**
 * Oculta el perfil cuando la persona autenticada bloqueó a su autor.
 *
 * El perfil público sigue siendo accesible sin sesión —igual que en cualquier
 * red social—, pero desde la cuenta que bloqueó no se muestra ni se puede
 * interactuar con él. El backend aplica además el bloqueo en relatos,
 * comentarios, seguimientos, notificaciones y recomendaciones.
 */
export default function ProfileAccessGuard({
  authorName,
  children,
}: {
  authorName: string;
  children: React.ReactNode;
}) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!tokenStorage.getAccess()) return;

    let active = true;
    void listAuthorPreferences().then((result) => {
      if (!active || result.status !== 'ok') return;
      const name = authorName.trim().toLowerCase();
      setBlocked(
        result.data.some(
          (item) => item.kind === 'BLOCK' && item.authorName.trim().toLowerCase() === name,
        ),
      );
    });

    return () => {
      active = false;
    };
  }, [authorName]);

  if (!blocked) {
    return <>{children}</>;
  }

  return (
    <section className="screen">
      <div className="auth-card card center">
        <div className="status-icon" aria-hidden="true">
          <Icon name="lock" />
        </div>
        <h1>Este perfil no está disponible</h1>
        <p className="auth-note">
          Bloqueaste a esta persona. Puedes revisar o quitar el bloqueo desde Cuenta →
          Bloqueados.
        </p>
      </div>
    </section>
  );
}
