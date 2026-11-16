'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import Icon from '@/components/wy/Icon';
import LanguageSwitcher from '@/components/wy/LanguageSwitcher';
import { useI18n } from '@/components/providers/I18nProvider';
import type { Account } from '@/lib/account';
import { ADMIN_TABS } from './nav';
import type { AdminTab } from './types';

interface AdminShellProps {
  account: Account;
  activeTab: AdminTab;
  onTab: (tab: AdminTab) => void;
  onLogout: () => void;
  toast?: string;
  children: ReactNode;
}

function Hamburger() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export default function AdminShell({
  account,
  activeTab,
  onTab,
  onLogout,
  toast,
  children,
}: AdminShellProps) {
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const active = ADMIN_TABS.find((tab) => tab.id === activeTab) ?? ADMIN_TABS[0];
  const initial = account.email.slice(0, 1).toUpperCase();

  const selectTab = (tab: AdminTab) => {
    onTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className={`wy admin-app${sidebarOpen ? ' sidebar-open' : ''}`}>
      <aside className="admin-sidebar" aria-label={t('admin.sidebar.navigation')}>
        <Link className="admin-brand" href="/admin" onClick={() => setSidebarOpen(false)}>
          <Image src="/withyouly-logo.png" alt="Withyouly" width={160} height={40} priority />
          <span className="admin-brand-pill">ADMIN</span>
        </Link>

        <nav className="admin-nav">
          {ADMIN_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeTab === item.id ? 'active' : undefined}
              aria-current={activeTab === item.id ? 'page' : undefined}
              onClick={() => selectTab(item.id)}
            >
              <Icon name={item.icon} />
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-account" title={account.email}>
            <span className="admin-avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="admin-account-copy">
              <b>{account.email}</b>
              <small>{account.role}</small>
            </span>
          </div>
          <Link className="admin-side-link" href="/feed">
            <Icon name="globe" />
            <span>{t('admin.sidebar.site')}</span>
          </Link>
          <button className="admin-side-link" type="button" onClick={onLogout}>
            <Icon name="user" />
            <span>{t('admin.sidebar.logout')}</span>
          </button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          className="admin-overlay"
          type="button"
          aria-label={t('admin.closeMenu')}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-title">
            <button
              className="admin-mobile-toggle"
              type="button"
              aria-label={t('admin.openMenu')}
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((value) => !value)}
            >
              <Hamburger />
            </button>
            <div>
              <span className="micro-label">{t('admin.kicker')}</span>
              <h1>{activeTab === 'overview' ? t('admin.title') : t(active.labelKey)}</h1>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <span className="admin-role-badge">
              <Icon name="shield" /> {account.role}
            </span>
            <LanguageSwitcher />
          </div>
        </header>

        <main className="admin-content" id="main">
          {children}
        </main>
      </div>

      <div className={`toast ${toast ? 'show' : ''}`} role="status">
        {toast}
      </div>
    </div>
  );
}
