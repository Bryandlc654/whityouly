'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';
import {
  deleteAdminStory,
  listAdminStories,
  setAdminStoryVisibility,
  type AdminStory,
  type AdminStoryStatus,
  type ContentVisibilityAction,
} from '@/lib/admin';
import { formatAdminDate, formatAdminNumber } from './helpers';
import ContentActionDialog from './ContentActionDialog';
import type { AdminNotify } from './types';

const PAGE_SIZE = 20;
type StatusFilter = AdminStoryStatus | 'ALL';
type ActionKind = ContentVisibilityAction | 'DELETE';

const STATUS_FILTERS: StatusFilter[] = [
  'PUBLISHED',
  'HIDDEN',
  'DELETED',
  'DRAFT',
  'WITHDRAWN',
  'ALL',
];

export default function AdminStoriesPanel({ notify }: { notify: AdminNotify }) {
  const { t, language } = useI18n();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PUBLISHED');
  const [items, setItems] = useState<AdminStory[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [target, setTarget] = useState<{ story: AdminStory; action: ActionKind } | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (nextCursor?: string) => {
      if (!nextCursor) {
        setLoading(true);
        setError('');
      }
      const result = await listAdminStories({
        cursor: nextCursor,
        search: appliedSearch || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
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
    [appliedSearch, statusFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const openAction = (story: AdminStory, action: ActionKind) => {
    setTarget({ story, action });
    setReason('');
    setActionError('');
  };

  const submit = async () => {
    if (!target || busy) return;
    const value = reason.trim();
    if (value.length < 5) {
      setActionError(t('admin.content.reasonMin'));
      return;
    }
    setBusy(true);
    setActionError('');
    const result =
      target.action === 'DELETE'
        ? await deleteAdminStory(target.story.id, value)
        : await setAdminStoryVisibility(target.story.id, target.action, value);
    setBusy(false);
    if (result.status === 'ok') {
      setTarget(null);
      notify(
        target.action === 'HIDE'
          ? t('admin.content.hidden')
          : target.action === 'RESTORE'
            ? t('admin.content.restored')
            : t('admin.content.deleted'),
      );
      void load();
      return;
    }
    setActionError(result.message);
  };

  const actionCopy =
    target?.action === 'HIDE'
      ? {
          title: t('admin.content.hideTitle'),
          description: t('admin.content.hideCopy'),
          confirm: t('admin.content.hide'),
          danger: false,
        }
      : target?.action === 'RESTORE'
        ? {
            title: t('admin.content.restoreTitle'),
            description: t('admin.content.restoreCopy'),
            confirm: t('admin.content.restore'),
            danger: false,
          }
        : {
            title: t('admin.content.deleteTitle'),
            description: t('admin.content.deleteCopy'),
            confirm: t('admin.content.delete'),
            danger: true,
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
          placeholder={t('admin.content.searchStories')}
          aria-label={t('admin.content.searchStories')}
        />
        <select
          className="field"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          aria-label={t('admin.content.filterStatus')}
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === 'ALL'
                ? t('admin.content.allStatuses')
                : t(`admin.content.status.${status}`)}
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

      {loading && items.length === 0 ? <p className="muted small">{t('admin.content.loading')}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon">
            <Icon name="book" />
          </div>
          <h2>{t('admin.content.emptyStoriesTitle')}</h2>
          <p>{t('admin.content.emptyStoriesCopy')}</p>
        </div>
      ) : null}

      <div className="stack">
        {items.map((story) => (
          <article className="card pad admin-content-card" key={story.id}>
            <div className="admin-user-main">
              <div className="moderation-case-tags">
                <span className={`status-pill ${story.status === 'PUBLISHED' ? 'published' : 'draft'}`}>
                  {t(`admin.content.status.${story.status}`)}
                </span>
                <span className="tag">{story.visibility}</span>
                <span className="tag">{story.language.toUpperCase()}</span>
              </div>
              <h2>{story.title || t('admin.content.untitled')}</h2>
              <p className="hint">
                {story.authorName || t('admin.content.unknownAuthor')}
                {story.authorEmail ? ` · ${story.authorEmail}` : ''} ·{' '}
                {formatAdminDate(story.createdAt, language)}
              </p>
              <p className="hint admin-content-meta">
                {formatAdminNumber(story.comments)} {t('admin.content.comments')} ·{' '}
                {formatAdminNumber(story.stages)} {t('admin.content.stages')} ·{' '}
                {formatAdminNumber(story.supports)} {t('admin.content.supports')}
              </p>
            </div>
            <div className="admin-content-actions">
              <a
                className="text-link"
                href={`/relato/${story.id}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t('admin.content.open')}
              </a>
              {story.canHide ? (
                <button className="secondary" type="button" onClick={() => openAction(story, 'HIDE')}>
                  {t('admin.content.hide')}
                </button>
              ) : null}
              {story.canRestore ? (
                <button className="secondary" type="button" onClick={() => openAction(story, 'RESTORE')}>
                  {t('admin.content.restore')}
                </button>
              ) : null}
              {story.canDelete ? (
                <button
                  className="secondary danger-button"
                  type="button"
                  onClick={() => openAction(story, 'DELETE')}
                >
                  {t('admin.content.delete')}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {cursor ? (
        <button className="btn-outline" type="button" disabled={loading} onClick={() => void load(cursor)}>
          {loading ? t('common.loading') : t('admin.content.loadMore')}
        </button>
      ) : null}

      {target ? (
        <ContentActionDialog
          title={actionCopy.title}
          description={`${actionCopy.description} ${target.story.title || t('admin.content.untitled')}`.trim()}
          confirmLabel={actionCopy.confirm}
          reason={reason}
          onReason={setReason}
          onCancel={() => setTarget(null)}
          onConfirm={() => void submit()}
          busy={busy}
          error={actionError}
          danger={actionCopy.danger}
        />
      ) : null}
    </div>
  );
}
