'use client';

import SettingsPage from '@/components/account/SettingsPage';
import ContentControlsSection from '@/components/account/ContentControlsSection';
import ContentPreferencesSection from '@/components/account/ContentPreferencesSection';

export default function ContentControlsPage() {
  return (
    <SettingsPage
      title="Control del contenido"
      copy="Ajusta el feed sin afectar a otras personas."
    >
      {() => (
        <>
          <ContentControlsSection />
          <ContentPreferencesSection />
        </>
      )}
    </SettingsPage>
  );
}
