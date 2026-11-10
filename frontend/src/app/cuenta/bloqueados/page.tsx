'use client';

import SettingsPage from '@/components/account/SettingsPage';
import ContentPreferencesSection from '@/components/account/ContentPreferencesSection';

export default function BlockedUsersPage() {
  return (
    <SettingsPage
      title="Silenciados y bloqueados"
      copy="Estas acciones son privadas; la otra persona no recibe una notificación."
    >
      {() => <ContentPreferencesSection emptyVariant="card" />}
    </SettingsPage>
  );
}
