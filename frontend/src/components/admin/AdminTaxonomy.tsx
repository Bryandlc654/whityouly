'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';
import { fetchTaxonomy, type TaxonomyCatalog } from '@/lib/taxonomy';
import {
  createCategory,
  createEmotion,
  createTag,
  deleteCategory,
  deleteEmotion,
  deleteTag,
  renameCategory,
  renameTag,
  updateEmotion,
  type AdminTaxonomyItem,
} from '@/lib/admin';
import type { AdminNotify } from './types';

type Kind = 'categories' | 'emotions' | 'tags';

interface EditorState {
  kind: Kind;
  item: AdminTaxonomyItem | null;
}

export default function AdminTaxonomyPanel({ notify }: { notify: AdminNotify }) {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState<TaxonomyCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<EditorState | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await fetchTaxonomy();
    if (result.status === 'ok') {
      setCatalog(result.data);
    } else {
      setError(result.message);
      setCatalog(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (kind: Kind) => {
    setEditor({ kind, item: null });
    setName('');
    setColorHex(kind === 'emotions' ? '#6246F5' : '');
    setFormError('');
  };

  const openEdit = (kind: Kind, item: AdminTaxonomyItem) => {
    setEditor({ kind, item });
    setName(item.name);
    setColorHex(item.colorHex ?? '');
    setFormError('');
  };

  const submit = async () => {
    if (!editor || saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError(t('admin.taxonomy.nameRequired'));
      return;
    }

    setSaving(true);
    setFormError('');

    let result;
    if (editor.kind === 'categories') {
      result = editor.item
        ? await renameCategory(editor.item.id, trimmed)
        : await createCategory(trimmed);
    } else if (editor.kind === 'tags') {
      result = editor.item
        ? await renameTag(editor.item.id, trimmed)
        : await createTag(trimmed);
    } else {
      result = editor.item
        ? await updateEmotion(editor.item.id, {
            name: trimmed,
            ...(colorHex ? { colorHex } : {}),
          })
        : await createEmotion(trimmed, colorHex || undefined);
    }

    setSaving(false);
    if (result.status === 'ok') {
      setEditor(null);
      notify(editor.item ? t('admin.taxonomy.saved') : t('admin.taxonomy.created'));
      void load();
      return;
    }
    setFormError(result.message);
  };

  const remove = async () => {
    if (!removeTarget?.item || removing) return;
    setRemoving(true);
    const id = removeTarget.item.id;
    const result =
      removeTarget.kind === 'categories'
        ? await deleteCategory(id)
        : removeTarget.kind === 'tags'
          ? await deleteTag(id)
          : await deleteEmotion(id);
    setRemoving(false);
    setRemoveTarget(null);
    if (result.status === 'ok') {
      notify(t('admin.taxonomy.deleted'));
      void load();
      return;
    }
    notify(result.message);
  };

  const groups: Array<{ kind: Kind; label: string; items: Array<{ id: string; name: string; colorHex?: string | null }> }> =
    catalog
      ? [
          { kind: 'categories', label: t('admin.taxonomy.categories'), items: catalog.categories },
          { kind: 'emotions', label: t('admin.taxonomy.emotions'), items: catalog.emotions },
          { kind: 'tags', label: t('admin.taxonomy.tags'), items: catalog.tags },
        ]
      : [];

  return (
    <div className="stack">
      <div className="admin-card-head">
        <div>
          <h2>{t('admin.taxonomy.title')}</h2>
          <p className="muted small">{t('admin.taxonomy.copy')}</p>
        </div>
        <button className="secondary" type="button" onClick={() => void load()}>
          {t('admin.taxonomy.refresh')}
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

      {loading && !catalog ? <p className="muted small">{t('admin.taxonomy.loading')}</p> : null}

      <div className="admin-taxonomy-grid">
        {groups.map((group) => (
          <article className="card pad" key={group.kind}>
            <div className="admin-card-head">
              <h2>{group.label}</h2>
              <span className="tag">{group.items.length}</span>
            </div>
            {group.items.length === 0 ? (
              <p className="muted small">{t('admin.taxonomy.empty')}</p>
            ) : (
              <ul className="admin-taxonomy-list">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <span className="admin-taxonomy-name">
                      {group.kind === 'emotions' && item.colorHex ? (
                        <i className="admin-color-dot" style={{ background: item.colorHex }} aria-hidden="true" />
                      ) : null}
                      {item.name}
                    </span>
                    <span className="admin-taxonomy-actions">
                      <button className="text-link" type="button" onClick={() => openEdit(group.kind, item)}>
                        {t('admin.taxonomy.edit')}
                      </button>
                      <button
                        className="text-link danger-button"
                        type="button"
                        onClick={() => setRemoveTarget({ kind: group.kind, item })}
                      >
                        {t('admin.taxonomy.delete')}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn-outline" type="button" onClick={() => openCreate(group.kind)}>
              <Icon name="plus" /> {t('admin.taxonomy.add')}
            </button>
          </article>
        ))}
      </div>

      {editor ? (
        <div className="modal-layer" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-taxonomy-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="modal-head">
              <div>
                <h2 id="admin-taxonomy-title">
                  {editor.item ? t('admin.taxonomy.editTitle') : t('admin.taxonomy.addTitle')}
                </h2>
                <p>
                  {editor.kind === 'categories'
                    ? t('admin.taxonomy.categories')
                    : editor.kind === 'tags'
                      ? t('admin.taxonomy.tags')
                      : t('admin.taxonomy.emotions')}
                </p>
              </div>
              <button
                className="close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setEditor(null)}
              >
                <Icon name="x" />
              </button>
            </div>

            <label className="field-label" htmlFor="admin-taxonomy-name">
              {t('admin.taxonomy.name')}
            </label>
            <input
              id="admin-taxonomy-name"
              className="field"
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('admin.taxonomy.namePlaceholder')}
              required
            />

            {editor.kind === 'emotions' ? (
              <>
                <label className="field-label" htmlFor="admin-taxonomy-color">
                  {t('admin.taxonomy.color')}
                </label>
                <input
                  id="admin-taxonomy-color"
                  className="field"
                  value={colorHex}
                  onChange={(event) => setColorHex(event.target.value)}
                  placeholder="#6246F5"
                />
                <p className="hint">{t('admin.taxonomy.colorHint')}</p>
              </>
            ) : null}

            {formError ? (
              <p className="auth-error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="modal-actions">
              <button className="ghost" type="button" disabled={saving} onClick={() => setEditor(null)}>
                {t('common.cancel')}
              </button>
              <button className="primary" type="submit" disabled={saving}>
                {saving ? t('admin.taxonomy.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {removeTarget ? (
        <div className="modal-layer" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="admin-taxonomy-delete">
            <div className="modal-head">
              <div>
                <h2 id="admin-taxonomy-delete">{t('admin.taxonomy.deleteTitle')}</h2>
                <p>{removeTarget.item?.name}</p>
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
            <p className="hint">{t('admin.taxonomy.deleteCopy')}</p>
            <div className="modal-actions">
              <button className="ghost" type="button" disabled={removing} onClick={() => setRemoveTarget(null)}>
                {t('common.cancel')}
              </button>
              <button className="primary" type="button" disabled={removing} onClick={() => void remove()}>
                {removing ? t('admin.taxonomy.deleting') : t('admin.taxonomy.delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
