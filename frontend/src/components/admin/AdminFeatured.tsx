'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';
import {
  featureStory,
  listAdminFeatured,
  unfeatureStory,
  type CuratedFeatured,
} from '@/lib/admin';
import { formatAdminDate } from './helpers';
import type { AdminNotify } from './types';

function storyIdFromInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? '';
  } catch {
    /* no es una URL: se usa tal cual */
  }
  return trimmed.split('?')[0].split('#')[0];
}

function dateInputValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export default function AdminFeaturedPanel({ notify }: { notify: AdminNotify }) {
  const { t, language } = useI18n();
  const [items, setItems] = useState<CuratedFeatured[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState<CuratedFeatured | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [storyInput, setStoryInput] = useState('');
  const [position, setPosition] = useState('0');
  const [note, setNote] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<CuratedFeatured | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await listAdminFeatured();
    if (result.status === 'ok') {
      setItems(result.data.items);
    } else {
      setError(result.message);
      setItems([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setStoryInput('');
    setPosition(String(items.length));
    setNote('');
    setExpiresAt('');
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (item: CuratedFeatured) => {
    setEditing(item);
    setStoryInput(item.storyId);
    setPosition(String(item.position));
    setNote(item.note ?? '');
    setExpiresAt(dateInputValue(item.expiresAt));
    setFormError('');
    setFormOpen(true);
  };

  const submit = async () => {
    if (saving) return;
    const storyId = storyIdFromInput(editing ? editing.storyId : storyInput);
    if (!storyId) {
      setFormError(t('admin.featured.invalidId'));
      return;
    }
    const parsedPosition = Number(position);
    if (!Number.isInteger(parsedPosition) || parsedPosition < 0) {
      setFormError(t('admin.featured.invalidPosition'));
      return;
    }

    setSaving(true);
    setFormError('');

    const expiresIso = expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null;
    const result = await featureStory(storyId, {
      position: parsedPosition,
      note,
      ...(editing || expiresAt ? { expiresAt: expiresIso } : {}),
    });

    setSaving(false);
    if (result.status === 'ok') {
      setFormOpen(false);
      notify(editing ? t('admin.featured.updated') : t('admin.featured.added'));
      void load();
      return;
    }
    setFormError(result.message);
  };

  const remove = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    const result = await unfeatureStory(removeTarget.storyId);
    setRemoving(false);
    if (result.status === 'ok') {
      setRemoveTarget(null);
      notify(t('admin.featured.removed'));
      void load();
      return;
    }
    setRemoveTarget(null);
    notify(result.message);
  };

  return (
    <div className="stack">
      <div className="admin-card-head">
        <div>
          <h2>{t('admin.featured.title')}</h2>
          <p className="muted small">{t('admin.featured.copy')}</p>
        </div>
        <button className="primary" type="button" onClick={openCreate}>
          {t('admin.featured.add')}
        </button>
      </div>

      {error ? (
        <div className="auth-error" role="alert">
          {error}
          <button className="text-link" type="button" style={{ marginLeft: 8 }} onClick={() => void load()}>
            {t('common.retry')}
          </button>
        </div>
      ) : null}

      {loading && items.length === 0 ? <p className="muted small">{t('admin.featured.loading')}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon">
            <Icon name="book" />
          </div>
          <h2>{t('admin.featured.emptyTitle')}</h2>
          <p>{t('admin.featured.emptyCopy')}</p>
        </div>
      ) : null}

      <div className="stack">
        {items.map((item) => (
          <article className="card pad admin-featured-card" key={item.storyId}>
            <div className="admin-user-main">
              <div className="moderation-case-tags">
                <span className="tag">#{item.position}</span>
                <span className={`status-pill ${item.status === 'PUBLISHED' ? 'published' : 'draft'}`}>
                  {item.status}
                </span>
              </div>
              <h2>{item.title}</h2>
              <p className="hint">
                {item.author || t('admin.featured.unknownAuthor')} ·{' '}
                {item.expiresAt
                  ? `${t('admin.featured.expires')} ${formatAdminDate(item.expiresAt, language)}`
                  : t('admin.featured.noExpiry')}
              </p>
              {item.note ? <p className="moderation-context">{item.note}</p> : null}
            </div>
            <div className="admin-user-actions">
              <button className="secondary" type="button" onClick={() => openEdit(item)}>
                {t('admin.featured.edit')}
              </button>
              <button className="secondary danger-button" type="button" onClick={() => setRemoveTarget(item)}>
                {t('admin.featured.remove')}
              </button>
            </div>
          </article>
        ))}
      </div>

      {formOpen ? (
        <div className="modal-layer" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-featured-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="modal-head">
              <div>
                <h2 id="admin-featured-title">
                  {editing ? t('admin.featured.editTitle') : t('admin.featured.addTitle')}
                </h2>
                <p>{editing ? editing.title : t('admin.featured.addCopy')}</p>
              </div>
              <button
                className="close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setFormOpen(false)}
              >
                <Icon name="x" />
              </button>
            </div>

            {!editing ? (
              <>
                <label className="field-label" htmlFor="admin-featured-story">
                  {t('admin.featured.storyId')}
                </label>
                <input
                  id="admin-featured-story"
                  className="field"
                  value={storyInput}
                  onChange={(event) => setStoryInput(event.target.value)}
                  placeholder={t('admin.featured.storyIdPlaceholder')}
                  required
                />
              </>
            ) : null}

            <label className="field-label" htmlFor="admin-featured-position">
              {t('admin.featured.position')}
            </label>
            <input
              id="admin-featured-position"
              className="field"
              type="number"
              min={0}
              step={1}
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            />

            <label className="field-label" htmlFor="admin-featured-note">
              {t('admin.featured.note')}
            </label>
            <input
              id="admin-featured-note"
              className="field"
              maxLength={160}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t('admin.featured.notePlaceholder')}
            />

            <label className="field-label" htmlFor="admin-featured-expires">
              {t('admin.featured.expiresLabel')}
            </label>
            <input
              id="admin-featured-expires"
              className="field"
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
            <p className="hint">{t('admin.featured.expiresHint')}</p>

            {formError ? (
              <p className="auth-error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="modal-actions">
              <button className="ghost" type="button" disabled={saving} onClick={() => setFormOpen(false)}>
                {t('common.cancel')}
              </button>
              <button className="primary" type="submit" disabled={saving}>
                {saving ? t('admin.featured.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {removeTarget ? (
        <div className="modal-layer" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="admin-featured-remove">
            <div className="modal-head">
              <div>
                <h2 id="admin-featured-remove">{t('admin.featured.removeTitle')}</h2>
                <p>{removeTarget.title}</p>
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
            <p className="hint">{t('admin.featured.removeCopy')}</p>
            <div className="modal-actions">
              <button className="ghost" type="button" disabled={removing} onClick={() => setRemoveTarget(null)}>
                {t('common.cancel')}
              </button>
              <button className="primary" type="button" disabled={removing} onClick={() => void remove()}>
                {removing ? t('admin.featured.removing') : t('admin.featured.remove')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
