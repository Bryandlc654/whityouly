'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';
import {
  deleteAdminFile,
  listAdminFiles,
  type AdminMediaFile,
} from '@/lib/admin';
import { formatAdminBytes, formatAdminDate, formatAdminNumber } from './helpers';
import type { AdminNotify } from './types';

const PAGE_SIZE = 24;

function FileThumb({ file }: { file: AdminMediaFile }) {
  const [failed, setFailed] = useState(false);
  const isImage = (file.mimeType ?? '').startsWith('image/');
  const isAudio = (file.mimeType ?? '').startsWith('audio/');

  if (isImage && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={file.fileUrl}
        alt={file.originalName ?? ''}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return <Icon name={isAudio ? 'mic' : 'image'} />;
}

export default function AdminFilesPanel({ notify }: { notify: AdminNotify }) {
  const { t, language } = useI18n();
  const [userId, setUserId] = useState('');
  const [appliedUserId, setAppliedUserId] = useState('');
  const [items, setItems] = useState<AdminMediaFile[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<AdminMediaFile | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(
    async (nextCursor?: string) => {
      if (!nextCursor) {
        setLoading(true);
        setError('');
      }
      const result = await listAdminFiles({
        cursor: nextCursor,
        userId: appliedUserId || undefined,
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
    [appliedUserId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    const result = await deleteAdminFile(removeTarget.id);
    setRemoving(false);
    if (result.status === 'ok') {
      setItems((prev) => prev.filter((item) => item.id !== removeTarget.id));
      setRemoveTarget(null);
      notify(t('admin.files.deleted'));
      return;
    }
    setRemoveTarget(null);
    notify(result.message);
  };

  return (
    <div className="stack">
      <form
        className="admin-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedUserId(userId.trim());
        }}
      >
        <input
          className="field"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          placeholder={t('admin.files.userIdPlaceholder')}
          aria-label={t('admin.files.userIdPlaceholder')}
        />
        <button className="primary" type="submit">
          {t('admin.files.filter')}
        </button>
        {appliedUserId ? (
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setUserId('');
              setAppliedUserId('');
            }}
          >
            {t('admin.files.clearFilter')}
          </button>
        ) : null}
      </form>

      {error ? (
        <div className="auth-error" role="alert">
          {error}
          <button className="text-link" type="button" style={{ marginLeft: 8 }} onClick={() => void load()}>
            {t('common.retry')}
          </button>
        </div>
      ) : null}

      {loading && items.length === 0 ? <p className="muted small">{t('admin.files.loading')}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon">
            <Icon name="image" />
          </div>
          <h2>{t('admin.files.emptyTitle')}</h2>
          <p>{t('admin.files.emptyCopy')}</p>
        </div>
      ) : null}

      <div className="admin-file-grid">
        {items.map((file) => {
          return (
            <article className="card admin-file-card" key={file.id}>
              <div className="admin-file-preview">
                <FileThumb file={file} />
              </div>
              <div className="admin-file-meta">
                <b title={file.originalName ?? file.id}>{file.originalName ?? file.id}</b>
                <small className="muted">
                  {file.mimeType ?? t('admin.files.unknownType')} · {formatAdminBytes(file.sizeBytes ?? 0)}
                </small>
                <small className="muted">
                  {formatAdminDate(file.createdAt, language)} · {t('admin.files.owner')}{' '}
                  {file.userEmail ?? (file.userId ? file.userId.slice(0, 8) : '—')}
                </small>
                {file.width && file.height ? (
                  <small className="muted">
                    {formatAdminNumber(file.width)} × {formatAdminNumber(file.height)}
                  </small>
                ) : null}
              </div>
              <div className="admin-file-actions">
                <a className="text-link" href={file.fileUrl} target="_blank" rel="noreferrer noopener">
                  {t('admin.files.open')}
                </a>
                <button
                  className="text-link danger-button"
                  type="button"
                  onClick={() => setRemoveTarget(file)}
                >
                  {t('admin.files.delete')}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {cursor ? (
        <button className="btn-outline" type="button" disabled={loading} onClick={() => void load(cursor)}>
          {loading ? t('common.loading') : t('admin.files.loadMore')}
        </button>
      ) : null}

      {removeTarget ? (
        <div className="modal-layer" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="admin-file-delete">
            <div className="modal-head">
              <div>
                <h2 id="admin-file-delete">{t('admin.files.deleteTitle')}</h2>
                <p>{removeTarget.originalName ?? removeTarget.id}</p>
              </div>
              <button
                className="close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setRemoveTarget(null)}
              >
                <Icon name="x" />
              </button>
            </div>
            <p className="hint">{t('admin.files.deleteCopy')}</p>
            <div className="modal-actions">
              <button className="ghost" type="button" disabled={removing} onClick={() => setRemoveTarget(null)}>
                {t('common.cancel')}
              </button>
              <button className="primary" type="button" disabled={removing} onClick={() => void remove()}>
                {removing ? t('admin.files.deleting') : t('admin.files.delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
