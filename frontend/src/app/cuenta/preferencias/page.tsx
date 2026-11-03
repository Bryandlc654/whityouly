'use client';

import SettingsPage from '@/components/account/SettingsPage';
import PreferencesSection from '@/components/account/PreferencesSection';

export default function PreferencesPage() {
  return (
    <SettingsPage
      title="Preferencias de la app"
      copy="Apariencia, idioma, lectura y avisos."
    >
      {(account, _character, reload) => (
        <PreferencesSection account={account} onSaved={() => void reload()} />
      )}
    </SettingsPage>
  );
}
