'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';
import {
  listAdminSupportTickets,
  updateAdminSupportTicket,
  type AdminSupportTicket,
} from '@/lib/admin';
import { SUPPORT_CATEGORIES, type SupportCategory, type SupportStatus } from '@/lib/support';
import { formatAdminDateTime } from './helpers';
import type { AdminNotify } from './types';

const PAGE_SIZE = 20;
type StatusFilter = SupportStatus | 'ALL';
type CategoryFilter = SupportCategory | 'ALL';

export default function AdminSupportPanel({ notify }: { notify: AdminNotify }) {
  const { t, language } = useI18n();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [items, setItems] = useState<AdminSupportTicket[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [target, setTarget] = useState<AdminSupportTicket | null>(null);
  const [statusValue, setStatusValue] = useState<SupportStatus>('OPEN');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (nextCursor?: string) => {
      if (!nextCursor) {
        setLoading(true);
        setError('');
      }
      const result = await listAdminSupportTickets({
        cursor: nextCursor,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        category: categoryFilter === 'ALL' ? undefined : categoryFilter,
        search: appliedSearch || undefined,
        limit: PAGE_SIZE,
      });
      if (result.status === 'ok') {
        setItems((prev) => (nextCursor ? [...prev, ...result.data.items] : result.data.items));
        setCursor(result.data.nextCursor);
      } else {
        setError(result.message);
        if (!nextCursor) setItems([]);
      }
      setLoading(false);
    },
    [statusFilter, categoryFilter, appliedSearch],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openTicket = (ticket: AdminSupportTicket) => {
    setTarget(ticket);
    setStatusValue(ticket.status);
    setNote(ticket.resolutionNote ?? '');
    setFormError('');
  };

  const submit = async () => {
    if (!target || saving) return;
    setSaving(true);
    setFormError('');
    const result = await updateAdminSupportTicket(target.id, {
      status: statusValue,
      resolutionNote: note.trim(),
    });
    setSaving(false);
    if (result.status === 'ok') {
      setItems((prev) => prev.map((item) => (item.id === result.data.id ? result.data : item)));
      setTarget(null);
      notify(t('admin.support.saved'));
      return;
    }
    setFormError(result.message);
  };

  const statuses: StatusFilter[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ALL'];

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
          placeholder={t('admin.support.searchPlaceholder')}
          aria-label={t('admin.support.searchPlaceholder')}
        />
        <select
          className="field"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          aria-label={t('admin.support.filterStatus')}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status === 'ALL' ? t('admin.mod.all') : t(`admin.support.status.${status}`)}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
          aria-label={t('admin.support.filterCategory')}
        >
          <option value="ALL">{t('admin.support.allCategories')}</option>
          {SUPPORT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t(`admin.support.category.${category}`)}
            </option>
          ))}
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

      {loading && items.length === 0 ? <p className="muted small">{t('admin.support.loading')}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon">
            <Icon name="help" />
          </div>
          <h2>{t('admin.support.emptyTitle')}</h2>
          <p>{t('admin.support.emptyCopy')}</p>
        </div>
      ) : null}

      <div className="stack">
        {items.map((ticket) => (
          <article className="card pad moderation-case" key={ticket.id}>
            <div className="moderation-case-head">
              <div>
                <div className="moderation-case-tags">
                  <span
                    className={`status-pill ${
                      ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS'
                        ? 'draft'
                        : 'published'
                    }`}
                  >
                    {t(`admin.support.status.${ticket.status}`)}
                  </span>
                  <span className="tag">{t(`admin.support.category.${ticket.category}`)}</span>
                </div>
                <h2>{ticket.userEmail ?? ticket.characterName ?? t('admin.support.unknownUser')}</h2>
                <p className="hint">
                  {ticket.characterName ? `${ticket.characterName} · ` : ''}
                  {formatAdminDateTime(ticket.createdAt, language)}
                </p>
                <p className="moderation-reason admin-support-body">{ticket.body}</p>
                {ticket.resolutionNote ? (
                  <p className="moderation-context">
                    {t('admin.mod.answer')}: {ticket.resolutionNote}
                  </p>
                ) : null}
              </div>
              <div className="moderation-actions">
                <button className="primary" type="button" onClick={() => openTicket(ticket)}>
                  {t('admin.support.manage')}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {cursor ? (
        <button className="btn-outline" type="button" disabled={loading} onClick={() => void load(cursor)}>
          {loading ? t('common.loading') : t('admin.support.loadMore')}
        </button>
      ) : null}

      {target ? (
        <div className="modal-layer" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-support-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="modal-head">
              <div>
                <h2 id="admin-support-title">{t('admin.support.manageTitle')}</h2>
                <p>{target.userEmail ?? target.characterName ?? t('admin.support.unknownUser')}</p>
              </div>
              <button
                className="close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setTarget(null)}
              >
                <Icon name="x" />
              </button>
            </div>

            <p className="moderation-reason admin-support-body">{target.body}</p>

            <label className="field-label" htmlFor="admin-support-status">
              {t('admin.support.statusLabel')}
            </label>
            <select
              id="admin-support-status"
              className="field"
              value={statusValue}
              onChange={(event) => setStatusValue(event.target.value as SupportStatus)}
            >
              {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as SupportStatus[]).map((status) => (
                <option key={status} value={status}>
                  {t(`admin.support.status.${status}`)}
                </option>
              ))}
            </select>

            <label className="field-label" htmlFor="admin-support-note">
              {t('admin.support.noteLabel')}
            </label>
            <textarea
              id="admin-support-note"
              className="field"
              maxLength={3000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('admin.support.notePlaceholder')}
            />

            {formError ? (
              <p className="auth-error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="modal-actions">
              <button className="ghost" type="button" disabled={saving} onClick={() => setTarget(null)}>
                {t('common.cancel')}
              </button>
              <button className="primary" type="submit" disabled={saving}>
                {saving ? t('admin.support.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
