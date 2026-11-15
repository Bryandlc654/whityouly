'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';
import { fetchAdminOverview, type AdminOverview } from '@/lib/admin';
import { formatAdminBytes, formatAdminDateTime, formatAdminNumber } from './helpers';
import type { AdminTab } from './types';

const ROLE_KEYS = ['USER', 'MODERATOR', 'ADMIN', 'SUPERADMIN'] as const;

export default function AdminOverviewPanel({
  onNavigate,
}: {
  onNavigate: (tab: AdminTab) => void;
}) {
  const { t, language } = useI18n();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await fetchAdminOverview();
    if (result.status === 'ok') {
      setData(result.data);
    } else {
      setError(result.message);
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="muted small">{t('admin.overview.loading')}</p>;
  }

  if (error || !data) {
    return (
      <div className="auth-error" role="alert">
        {error || t('admin.overview.error')}
        <button className="text-link" type="button" style={{ marginLeft: 8 }} onClick={() => void load()}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const quickLinks: Array<{ tab: AdminTab; label: string; icon: 'shield' | 'users' | 'book' | 'help' }> = [
    { tab: 'reports', label: t('admin.tab.reports'), icon: 'shield' },
    { tab: 'users', label: t('admin.tab.users'), icon: 'users' },
    { tab: 'support', label: t('admin.tab.support'), icon: 'help' },
    { tab: 'featured', label: t('admin.tab.featured'), icon: 'book' },
  ];

  return (
    <div className="stack admin-overview">
      <div className="admin-kpi-grid">
        <article className="card pad admin-kpi">
          <span className="micro-label">{t('admin.overview.totalUsers')}</span>
          <strong>{formatAdminNumber(data.users.total)}</strong>
          <small className="muted">
            {formatAdminNumber(data.users.active)} {t('admin.overview.active')} ·{' '}
            {formatAdminNumber(data.users.newLast7Days)} {t('admin.overview.last7')}
          </small>
        </article>
        <article className="card pad admin-kpi">
          <span className="micro-label">{t('admin.overview.published')}</span>
          <strong>{formatAdminNumber(data.content.publishedStories)}</strong>
          <small className="muted">
            {formatAdminNumber(data.content.stories)} {t('admin.overview.stories')} ·{' '}
            {formatAdminNumber(data.content.comments)} {t('admin.overview.comments')}
          </small>
        </article>
        <article className="card pad admin-kpi">
          <span className="micro-label">{t('admin.overview.pendingReports')}</span>
          <strong>{formatAdminNumber(data.moderation.reportsPending)}</strong>
          <small className="muted">
            {formatAdminNumber(data.moderation.reportsInReview)} {t('admin.overview.inReview')} ·{' '}
            {formatAdminNumber(data.moderation.appealsPending)} {t('admin.overview.appeals')}
          </small>
        </article>
        <article className="card pad admin-kpi">
          <span className="micro-label">{t('admin.overview.openSupport')}</span>
          <strong>{formatAdminNumber(data.support.open + data.support.inProgress)}</strong>
          <small className="muted">
            {formatAdminNumber(data.support.open)} {t('admin.support.status.OPEN')} ·{' '}
            {formatAdminNumber(data.support.inProgress)} {t('admin.support.status.IN_PROGRESS')}
          </small>
        </article>
      </div>

      <div className="admin-quick-row">
        {quickLinks.map((item) => (
          <button key={item.tab} className="btn-outline" type="button" onClick={() => onNavigate(item.tab)}>
            <Icon name={item.icon} /> {item.label}
          </button>
        ))}
      </div>

      <div className="admin-two-col">
        <article className="card pad">
          <div className="admin-card-head">
            <h2>{t('admin.overview.users')}</h2>
            <button className="text-link" type="button" onClick={() => onNavigate('users')}>
              {t('admin.overview.manage')}
            </button>
          </div>
          <div className="admin-stat-row">
            <span>{t('admin.overview.active')}</span>
            <b>{formatAdminNumber(data.users.active)}</b>
          </div>
          <div className="admin-stat-row">
            <span>{t('admin.overview.suspended')}</span>
            <b>{formatAdminNumber(data.users.suspended)}</b>
          </div>
          <div className="admin-stat-row">
            <span>{t('admin.overview.verified')}</span>
            <b>{formatAdminNumber(data.users.verified)}</b>
          </div>
          <div className="admin-role-chips">
            {ROLE_KEYS.map((role) => (
              <span className="tag" key={role}>
                {role}: {formatAdminNumber(data.users.byRole[role])}
              </span>
            ))}
          </div>
        </article>

        <article className="card pad">
          <div className="admin-card-head">
            <h2>{t('admin.overview.content')}</h2>
          </div>
          <div className="admin-stat-row">
            <span>{t('admin.overview.characters')}</span>
            <b>{formatAdminNumber(data.content.characters)}</b>
          </div>
          <div className="admin-stat-row">
            <span>{t('admin.overview.media')}</span>
            <b>{formatAdminNumber(data.content.media.count)}</b>
          </div>
          <div className="admin-stat-row">
            <span>{t('admin.overview.storage')}</span>
            <b>{formatAdminBytes(data.content.media.bytes)}</b>
          </div>
          <div className="admin-stat-row">
            <span>{t('admin.overview.actions7')}</span>
            <b>{formatAdminNumber(data.moderation.actionsLast7Days)}</b>
          </div>
        </article>
      </div>

      <div className="admin-two-col">
        <article className="card pad">
          <div className="admin-card-head">
            <h2>{t('admin.overview.recentUsers')}</h2>
            <button className="text-link" type="button" onClick={() => onNavigate('users')}>
              {t('admin.overview.manage')}
            </button>
          </div>
          {data.recent.users.length === 0 ? (
            <p className="muted small">{t('admin.overview.noActivity')}</p>
          ) : (
            <ul className="admin-feed">
              {data.recent.users.map((user) => (
                <li key={user.id}>
                  <div>
                    <b>{user.email}</b>
                    <small className="muted">
                      {user.role} · {formatAdminDateTime(user.createdAt, language)}
                    </small>
                  </div>
                  <span className={`status-pill ${user.status === 'ACTIVE' ? 'published' : 'draft'}`}>
                    {user.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card pad">
          <div className="admin-card-head">
            <h2>{t('admin.overview.recentActions')}</h2>
            <button className="text-link" type="button" onClick={() => onNavigate('history')}>
              {t('admin.overview.history')}
            </button>
          </div>
          {data.recent.actions.length === 0 ? (
            <p className="muted small">{t('admin.overview.noActivity')}</p>
          ) : (
            <ul className="admin-feed">
              {data.recent.actions.map((action) => (
                <li key={action.id}>
                  <div>
                    <b>{t(`admin.mod.action.${action.action}`)}</b>
                    <small className="muted">
                      {action.actorEmail ?? '—'} · {formatAdminDateTime(action.createdAt, language)}
                    </small>
                    <small className="admin-feed-reason">{action.reason}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  );
}
