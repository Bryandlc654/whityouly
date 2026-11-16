import type { IconName } from '@/components/wy/icons';
import type { AdminTab } from './types';

/** Navegación única del panel: la comparten el sidebar y la cabecera. */
export const ADMIN_TABS: Array<{ id: AdminTab; labelKey: string; icon: IconName }> = [
  { id: 'overview', labelKey: 'admin.tab.overview', icon: 'pulse' },
  { id: 'users', labelKey: 'admin.tab.users', icon: 'users' },
  { id: 'content', labelKey: 'admin.tab.content', icon: 'book' },
  { id: 'reports', labelKey: 'admin.tab.reports', icon: 'shield' },
  { id: 'appeals', labelKey: 'admin.tab.appeals', icon: 'restore' },
  { id: 'history', labelKey: 'admin.tab.history', icon: 'clock' },
  { id: 'featured', labelKey: 'admin.tab.featured', icon: 'book' },
  { id: 'taxonomy', labelKey: 'admin.tab.taxonomy', icon: 'settings' },
  { id: 'files', labelKey: 'admin.tab.files', icon: 'image' },
  { id: 'support', labelKey: 'admin.tab.support', icon: 'help' },
];

export const ADMIN_TAB_IDS = new Set<AdminTab>(ADMIN_TABS.map((tab) => tab.id));
