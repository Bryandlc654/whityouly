'use client';

import { useState } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import AdminStoriesPanel from './AdminStoriesPanel';
import AdminCommentsPanel from './AdminCommentsPanel';
import type { AdminNotify } from './types';

type ContentTab = 'stories' | 'comments';

export default function AdminContentPanel({ notify }: { notify: AdminNotify }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<ContentTab>('stories');

  return (
    <div className="stack">
      <div className="admin-content-head">
        <div>
          <h2>{t('admin.content.title')}</h2>
          <p className="muted small">{t('admin.content.copy')}</p>
        </div>
        <div className="segmented" role="tablist" aria-label={t('admin.content.tabsAria')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'stories'}
            className={tab === 'stories' ? 'active' : undefined}
            onClick={() => setTab('stories')}
          >
            {t('admin.content.tabStories')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'comments'}
            className={tab === 'comments' ? 'active' : undefined}
            onClick={() => setTab('comments')}
          >
            {t('admin.content.tabComments')}
          </button>
        </div>
      </div>

      {tab === 'stories' ? <AdminStoriesPanel notify={notify} /> : null}
      {tab === 'comments' ? <AdminCommentsPanel notify={notify} /> : null}
    </div>
  );
}
