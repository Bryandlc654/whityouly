'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAccount, type Account } from '@/lib/account';
import { ensureAccessToken, logout as endSession, tokenStorage } from '@/lib/auth';
import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';
import AdminShell from '@/components/admin/AdminShell';
import AdminOverviewPanel from '@/components/admin/AdminOverview';
import AdminUsersPanel from '@/components/admin/AdminUsers';
import AdminContentPanel from '@/components/admin/AdminContentPanel';
import AdminModerationPanel from '@/components/admin/AdminModeration';
import AdminFeaturedPanel from '@/components/admin/AdminFeatured';
import AdminTaxonomyPanel from '@/components/admin/AdminTaxonomy';
import AdminFilesPanel from '@/components/admin/AdminFiles';
import AdminSupportPanel from '@/components/admin/AdminSupport';
import AdminStepUp from '@/components/admin/AdminStepUp';
import { ADMIN_TAB_IDS } from '@/components/admin/nav';
import type { AdminTab } from '@/components/admin/types';

export default function AdminPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [fatal, setFatal] = useState('');
  const [tab, setTab] = useState<AdminTab>('overview');

  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested && ADMIN_TAB_IDS.has(requested as AdminTab)) {
      setTab(requested as AdminTab);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!(await ensureAccessToken())) {
        router.replace('/login');
        return;
      }

      const accountResult = await fetchAccount();

      if (!active) return;

      if (accountResult.status !== 'ok') {
        setFatal(accountResult.message);
        setChecking(false);
        return;
      }

      if (accountResult.data.role !== 'SUPERADMIN' || accountResult.data.status !== 'ACTIVE') {
        setForbidden(true);
        setChecking(false);
        return;
      }

      setAccount(accountResult.data);
      setChecking(false);
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [router]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const changeTab = (next: AdminTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url.toString());
  };

  if (checking) {
    return (
      <div className="wy admin-gate">
        <p className="muted small">{t('admin.checking')}</p>
      </div>
    );
  }

  if (fatal || forbidden || !account) {
    return (
      <div className="wy admin-gate">
        <div className="card pad admin-gate-card">
          <span className="admin-gate-icon">
            <Icon name={forbidden ? 'lock' : 'shield'} />
          </span>
          <h1>{forbidden ? t('admin.forbiddenTitle') : t('admin.errorTitle')}</h1>
          <p className="muted">
            {forbidden ? t('admin.forbiddenCopy') : fatal || t('admin.errorCopy')}
          </p>
          <div className="admin-gate-actions">
            <button className="primary" type="button" onClick={() => router.push('/feed')}>
              {t('admin.backToFeed')}
            </button>
            <button className="ghost" type="button" onClick={() => void logout()}>
              {t('admin.sidebar.logout')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      account={account}
      activeTab={tab}
      onTab={changeTab}
      onLogout={() => void logout()}
      toast={toast}
    >
      <AdminStepUp />
      {tab === 'overview' ? <AdminOverviewPanel onNavigate={changeTab} /> : null}
      {tab === 'users' ? <AdminUsersPanel currentUserId={account.id} notify={notify} /> : null}
      {tab === 'content' ? <AdminContentPanel notify={notify} /> : null}
      {tab === 'reports' ? <AdminModerationPanel mode="reports" notify={notify} /> : null}
      {tab === 'appeals' ? <AdminModerationPanel mode="appeals" notify={notify} /> : null}
      {tab === 'history' ? <AdminModerationPanel mode="history" notify={notify} /> : null}
      {tab === 'featured' ? <AdminFeaturedPanel notify={notify} /> : null}
      {tab === 'taxonomy' ? <AdminTaxonomyPanel notify={notify} /> : null}
      {tab === 'files' ? <AdminFilesPanel notify={notify} /> : null}
      {tab === 'support' ? <AdminSupportPanel notify={notify} /> : null}
    </AdminShell>
  );
}
