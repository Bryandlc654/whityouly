'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';
import { SESSION_EXPIRED_EVENT } from '@/lib/auth';
import { rememberReturnTo } from '@/lib/returnTo';

const AUTH_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/confirm-email',
  '/onboarding',
];

function isAuthPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default function SessionExpiredGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [expired, setExpired] = useState(false);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (isAuthPath(pathname)) {
      expiredRef.current = false;
      setExpired(false);
    }
  }, [pathname]);

  useEffect(() => {
    const handleExpired = () => {
      if (isAuthPath(window.location.pathname) || expiredRef.current) return;
      expiredRef.current = true;
      rememberReturnTo(`${window.location.pathname}${window.location.search}`);
      setExpired(true);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  const goToLogin = useCallback(() => {
    setExpired(false);
    expiredRef.current = false;
    router.replace('/login?motivo=sesion');
  }, [router]);

  if (!expired) return null;

  return (
    <div className="wy">
      <div className="modal-layer session-expired-layer">
        <section
          className="modal session-expired-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sessionExpiredTitle"
        >
          <div className="modal-head">
            <div>
              <span className="micro-label">{t('session.kicker')}</span>
              <h2 id="sessionExpiredTitle">{t('session.expiredTitle')}</h2>
              <p>{t('session.expiredCopy')}</p>
            </div>
            <span className="session-expired-icon" aria-hidden="true">
              <Icon name="lock" />
            </span>
          </div>
          <div className="modal-actions">
            <button className="primary" type="button" onClick={goToLogin}>
              {t('session.expiredCta')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
