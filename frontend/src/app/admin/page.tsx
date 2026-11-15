'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { fetchAccount, type Account } from '@/lib/account';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import Icon from '@/components/wy/Icon';
import type { IconName } from '@/components/wy/icons';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import { useI18n } from '@/components/providers/I18nProvider';
import AdminOverviewPanel from '@/components/admin/AdminOverview';
import AdminUsersPanel from '@/components/admin/AdminUsers';
import AdminModerationPanel from '@/components/admin/AdminModeration';
import AdminFeaturedPanel from '@/components/admin/AdminFeatured';
import AdminTaxonomyPanel from '@/components/admin/AdminTaxonomy';
import AdminFilesPanel from '@/components/admin/AdminFiles';
import AdminSupportPanel from '@/components/admin/AdminSupport';
import type { AdminTab } from '@/components/admin/types';

const TABS: Array<{ id: AdminTab; labelKey: string; icon: IconName }> = [
  { id: 'overview', labelKey: 'admin.tab.overview', icon: 'pulse' },
  { id: 'users', labelKey: 'admin.tab.users', icon: 'users' },
  { id: 'reports', labelKey: 'admin.tab.reports', icon: 'shield' },
  { id: 'appeals', labelKey: 'admin.tab.appeals', icon: 'restore' },
  { id: 'history', labelKey: 'admin.tab.history', icon: 'clock' },
  { id: 'featured', labelKey: 'admin.tab.featured', icon: 'book' },
  { id: 'taxonomy', labelKey: 'admin.tab.taxonomy', icon: 'settings' },
  { id: 'files', labelKey: 'admin.tab.files', icon: 'image' },
  { id: 'support', labelKey: 'admin.tab.support', icon: 'help' },
];

const VALID_TABS = new Set<AdminTab>(TABS.map((tab) => tab.id));

function initialsOf(name?: string | null): string {
  if (!name) return 'WY';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [account, setAccount] = useState<Account | null>(null);
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [checking, setChecking] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [fatal, setFatal] = useState('');
  const [tab, setTab] = useState<AdminTab>('overview');

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

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
    if (requested && VALID_TABS.has(requested as AdminTab)) {
      setTab(requested as AdminTab);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/login');
        return;
      }

      const [accountResult, meResponse] = await Promise.all([
        fetchAccount(),
        authFetch(`${API_URL}/characters/me`).catch(() => null),
      ]);

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

      if (meResponse?.ok) {
        try {
          setCharacter(await meResponse.json());
        } catch {
          /* el marco funciona sin avatar */
        }
      }

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

  const openAccount = () => {
    const rows: SheetRow[] = [
      { label: t('admin.sheet.feed'), icon: 'home', onClick: () => router.push('/feed') },
      { label: t('admin.sheet.moderation'), icon: 'shield', onClick: () => router.push('/moderacion') },
      { label: t('admin.sheet.account'), icon: 'settings', onClick: () => router.push('/cuenta') },
      { label: t('admin.sheet.logout'), icon: 'user', danger: true, onClick: () => void logout() },
    ];
    setSheet({ title: t('admin.sheet.title'), rows });
  };

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        router.push('/feed');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'mood':
        router.push('/mi-diario');
        break;
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'help':
        router.push('/ayuda');
        break;
      default:
        notify(t('admin.sheet.comingSoon'));
    }
  };

  const changeTab = (next: AdminTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url.toString());
  };

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="profile"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen admin-page">
        <div className="welcome-row">
          <div>
            <span className="micro-label">{t('admin.kicker')}</span>
            <h1>{t('admin.title')}</h1>
            <p className="muted small">{t('admin.subtitle')}</p>
          </div>
          {account ? (
            <span className="account-badge">
              <Icon name="shield" /> {account.role}
            </span>
          ) : null}
        </div>

        {checking ? <p className="muted small">{t('admin.checking')}</p> : null}

        {!checking && fatal ? (
          <div className="auth-error" role="alert">
            {fatal}
            <button className="text-link" type="button" style={{ marginLeft: 8 }} onClick={() => router.push('/feed')}>
              {t('admin.backToFeed')}
            </button>
          </div>
        ) : null}

        {!checking && forbidden ? (
          <div className="empty card">
            <div className="empty-icon">
              <Icon name="lock" />
            </div>
            <h2>{t('admin.forbiddenTitle')}</h2>
            <p>{t('admin.forbiddenCopy')}</p>
            <button className="primary" type="button" onClick={() => router.push('/feed')}>
              {t('admin.backToFeed')}
            </button>
          </div>
        ) : null}

        {!checking && !forbidden && !fatal && account ? (
          <>
            <div className="admin-tabs" role="tablist" aria-label={t('admin.tabsAria')}>
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={tab === item.id ? 'active' : undefined}
                  onClick={() => changeTab(item.id)}
                >
                  <Icon name={item.icon} />
                  <span>{t(item.labelKey)}</span>
                </button>
              ))}
            </div>

            {tab === 'overview' ? <AdminOverviewPanel onNavigate={changeTab} /> : null}
            {tab === 'users' ? <AdminUsersPanel currentUserId={account.id} notify={notify} /> : null}
            {tab === 'reports' ? <AdminModerationPanel mode="reports" notify={notify} /> : null}
            {tab === 'appeals' ? <AdminModerationPanel mode="appeals" notify={notify} /> : null}
            {tab === 'history' ? <AdminModerationPanel mode="history" notify={notify} /> : null}
            {tab === 'featured' ? <AdminFeaturedPanel notify={notify} /> : null}
            {tab === 'taxonomy' ? <AdminTaxonomyPanel notify={notify} /> : null}
            {tab === 'files' ? <AdminFilesPanel notify={notify} /> : null}
            {tab === 'support' ? <AdminSupportPanel notify={notify} /> : null}
          </>
        ) : null}
      </section>
    </WyFrame>
  );
}
