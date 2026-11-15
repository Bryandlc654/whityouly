'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';
import {
  listAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
  type AdminRole,
  type AdminUser,
  type AdminUserStatus,
} from '@/lib/admin';
import { formatAdminDate, formatAdminNumber } from './helpers';
import type { AdminNotify } from './types';

const PAGE_SIZE = 20;
const ROLES: AdminRole[] = ['USER', 'MODERATOR', 'ADMIN', 'SUPERADMIN'];
type RoleFilter = AdminRole | 'ALL';
type StatusFilter = AdminUserStatus | 'ALL';

export default function AdminUsersPanel({
  currentUserId,
  notify,
}: {
  currentUserId: string;
  notify: AdminNotify;
}) {
  const { t, language } = useI18n();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [roleValue, setRoleValue] = useState<AdminRole>('USER');
  const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(
    async (nextCursor?: string) => {
      if (!nextCursor) {
        setError('');
        setLoading(true);
      }
      const result = await listAdminUsers({
        cursor: nextCursor,
        search: appliedSearch || undefined,
        role: roleFilter === 'ALL' ? undefined : roleFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: PAGE_SIZE,
      });

      if (result.status === 'ok') {
        setUsers((prev) => (nextCursor ? [...prev, ...result.data.items] : result.data.items));
        setCursor(result.data.nextCursor);
      } else {
        setError(result.message);
        if (!nextCursor) setUsers([]);
      }
      setLoading(false);
    },
    [appliedSearch, roleFilter, statusFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openRole = (user: AdminUser) => {
    setRoleTarget(user);
    setRoleValue(user.role);
    setActionError('');
  };

  const openStatus = (user: AdminUser) => {
    setStatusTarget(user);
    setActionError('');
  };

  const submitRole = async () => {
    if (!roleTarget || busy) return;
    setBusy(true);
    setActionError('');
    const result = await updateAdminUserRole(roleTarget.id, roleValue);
    setBusy(false);
    if (result.status === 'ok') {
      setUsers((prev) => prev.map((item) => (item.id === result.data.id ? result.data : item)));
      setRoleTarget(null);
      notify(t('admin.users.roleSaved'));
      return;
    }
    setActionError(result.message);
  };

  const submitStatus = async () => {
    if (!statusTarget || busy) return;
    const nextStatus: AdminUserStatus = statusTarget.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setBusy(true);
    setActionError('');
    const result = await updateAdminUserStatus(statusTarget.id, nextStatus);
    setBusy(false);
    if (result.status === 'ok') {
      setUsers((prev) => prev.map((item) => (item.id === result.data.id ? result.data : item)));
      setStatusTarget(null);
      notify(t('admin.users.statusSaved'));
      return;
    }
    setActionError(result.message);
  };

  return (
    <div className="stack">
      <form
        className="admin-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(search.trim());
        }}
      >
        <input
          className="field"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('admin.users.searchPlaceholder')}
          aria-label={t('admin.users.searchPlaceholder')}
        />
        <select
          className="field"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
          aria-label={t('admin.users.filterRole')}
        >
          <option value="ALL">{t('admin.users.allRoles')}</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          aria-label={t('admin.users.filterStatus')}
        >
          <option value="ALL">{t('admin.users.allStatuses')}</option>
          <option value="ACTIVE">{t('admin.users.status.ACTIVE')}</option>
          <option value="SUSPENDED">{t('admin.users.status.SUSPENDED')}</option>
        </select>
        <button className="primary" type="submit">
          {t('common.search')}
        </button>
      </form>

      {error ? (
        <div className="auth-error" role="alert">
          {error}
          <button className="text-link" type="button" style={{ marginLeft: 8 }} onClick={() => void load()}>
            {t('common.retry')}
          </button>
        </div>
      ) : null}

      {loading && users.length === 0 ? <p className="muted small">{t('admin.users.loading')}</p> : null}

      {!loading && !error && users.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon">
            <Icon name="users" />
          </div>
          <h2>{t('admin.users.emptyTitle')}</h2>
          <p>{t('admin.users.emptyCopy')}</p>
        </div>
      ) : null}

      <div className="stack admin-user-list">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <article className="card pad admin-user-card" key={user.id}>
              <div className="admin-user-main">
                <div className="admin-user-tags">
                  <span className={`status-pill ${user.status === 'ACTIVE' ? 'published' : 'draft'}`}>
                    {t(`admin.users.status.${user.status}`)}
                  </span>
                  <span className="tag">{user.role}</span>
                  <span className="tag">
                    {user.isEmailVerified ? t('admin.users.verified') : t('admin.users.unverified')}
                  </span>
                  {isSelf ? <span className="tag">{t('admin.users.you')}</span> : null}
                </div>
                <h2>{user.email}</h2>
                {user.characterName ? <p className="hint">@{user.characterName}</p> : null}
                <p className="hint">
                  {t('admin.users.created')} {formatAdminDate(user.createdAt, language)} ·{' '}
                  {formatAdminNumber(user.counts.stories)} {t('admin.users.stories')} ·{' '}
                  {formatAdminNumber(user.counts.media)} {t('admin.users.media')} ·{' '}
                  {formatAdminNumber(user.counts.activeSessions)} {t('admin.users.sessions')}
                </p>
              </div>
              <div className="admin-user-actions">
                <button
                  className="secondary"
                  type="button"
                  disabled={isSelf}
                  title={isSelf ? t('admin.users.selfHint') : undefined}
                  onClick={() => openRole(user)}
                >
                  {t('admin.users.changeRole')}
                </button>
                <button
                  className={user.status === 'ACTIVE' ? 'secondary danger-button' : 'secondary'}
                  type="button"
                  disabled={isSelf}
                  title={isSelf ? t('admin.users.selfHint') : undefined}
                  onClick={() => openStatus(user)}
                >
                  {user.status === 'ACTIVE' ? t('admin.users.suspend') : t('admin.users.reactivate')}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {cursor ? (
        <button className="btn-outline" type="button" disabled={loading} onClick={() => void load(cursor)}>
          {loading ? t('common.loading') : t('admin.users.loadMore')}
        </button>
      ) : null}

      {roleTarget ? (
        <div className="modal-layer" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-role-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submitRole();
            }}
          >
            <div className="modal-head">
              <div>
                <h2 id="admin-role-title">{t('admin.users.roleTitle')}</h2>
                <p>{roleTarget.email}</p>
              </div>
              <button
                className="close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setRoleTarget(null)}
              >
                <Icon name="x" />
              </button>
            </div>
            <p className="hint">{t('admin.users.roleCopy')}</p>
            <label className="field-label" htmlFor="admin-role-value">
              {t('admin.users.roleLabel')}
            </label>
            <select
              id="admin-role-value"
              className="field"
              value={roleValue}
              onChange={(event) => setRoleValue(event.target.value as AdminRole)}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            {actionError ? (
              <p className="auth-error" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="modal-actions">
              <button className="ghost" type="button" disabled={busy} onClick={() => setRoleTarget(null)}>
                {t('common.cancel')}
              </button>
              <button className="primary" type="submit" disabled={busy || roleValue === roleTarget.role}>
                {busy ? t('admin.users.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {statusTarget ? (
        <div className="modal-layer" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-status-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submitStatus();
            }}
          >
            <div className="modal-head">
              <div>
                <h2 id="admin-status-title">
                  {statusTarget.status === 'ACTIVE'
                    ? t('admin.users.suspendTitle')
                    : t('admin.users.reactivateTitle')}
                </h2>
                <p>{statusTarget.email}</p>
              </div>
              <button
                className="close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setStatusTarget(null)}
              >
                <Icon name="x" />
              </button>
            </div>
            <p className="hint">
              {statusTarget.status === 'ACTIVE'
                ? t('admin.users.suspendCopy')
                : t('admin.users.reactivateCopy')}
            </p>
            {actionError ? (
              <p className="auth-error" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="modal-actions">
              <button className="ghost" type="button" disabled={busy} onClick={() => setStatusTarget(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="primary"
                type="submit"
                disabled={busy}
              >
                {busy ? t('admin.users.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
