'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { fetchAccount } from '@/lib/account';
import { ROLE_CACHE_KEY, SESSION_CHANGED_EVENT, tokenStorage } from '@/lib/auth';
import { useI18n } from '@/components/providers/I18nProvider';

let roleInFlight: Promise<string | null> | null = null;

function readRole(): string | null {
  try {
    return sessionStorage.getItem(ROLE_CACHE_KEY);
  } catch {
    return null;
  }
}

/**
 * Acceso directo al panel de superadministración. El rol se cachea por pestaña
 * para no repetir `/users/me` en cada página; si no hay caché se consulta una
 * sola vez y se comparte la petición entre montajes simultáneos.
 */
export default function AdminEntry() {
  const { t } = useI18n();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const resolve = () => {
      const cached = readRole();
      if (cached) {
        setRole(cached);
        return;
      }
      if (!tokenStorage.getAccess()) return;

      if (!roleInFlight) {
        roleInFlight = fetchAccount()
          .then((result) => (result.status === 'ok' ? result.data.role : null))
          .then((value) => {
            if (value) {
              try {
                sessionStorage.setItem(ROLE_CACHE_KEY, value);
              } catch {
                /* almacenamiento bloqueado */
              }
            }
            return value;
          })
          .catch(() => null)
          .finally(() => {
            roleInFlight = null;
          });
      }

      void roleInFlight.then((value) => {
        if (active) setRole(value);
      });
    };

    resolve();

    const onSessionChanged = () => {
      setRole(null);
      resolve();
    };

    window.addEventListener(SESSION_CHANGED_EVENT, onSessionChanged);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHANGED_EVENT, onSessionChanged);
    };
  }, []);

  if (role !== 'SUPERADMIN') return null;

  return (
    <Link className="icon-btn admin-entry" href="/admin" aria-label={t('admin.title')} title={t('admin.title')}>
      <span data-icon="shield">
        <Icon name="shield" />
      </span>
    </Link>
  );
}
