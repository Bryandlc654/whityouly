'use client';

import SettingsPage from '@/components/account/SettingsPage';
import PrivacySection from '@/components/account/PrivacySection';
import DataExportSection from '@/components/account/DataExportSection';
import FilesSection from '@/components/account/FilesSection';
import DeleteAccountSection from '@/components/account/DeleteAccountSection';

export default function PrivacyDataPage() {
  return (
    <SettingsPage
      title="Privacidad y mis datos"
      copy="Decide qué conservar, descargar o eliminar."
    >
      {(account, character, reload) => (
        <>
          <PrivacySection
            settings={character?.privacySettings}
            onSaved={() => void reload()}
          />
          <DataExportSection />
          <FilesSection usage={account.usage} />
          <DeleteAccountSection account={account} onReload={reload} />
        </>
      )}
    </SettingsPage>
  );
}
