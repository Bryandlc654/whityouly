'use client';

import SettingsPage from '@/components/account/SettingsPage';
import ReadingSizeChooser from '@/components/account/ReadingSizeChooser';

export default function ReadingSettingsPage() {
  return (
    <SettingsPage
      title="Tamaño de lectura"
      copy="Elige cómo prefieres leer relatos y comentarios. Los menús y botones mantienen su tamaño."
    >
      {(account, _character, reload) => (
        <ReadingSizeChooser account={account} onSaved={() => void reload()} />
      )}
    </SettingsPage>
  );
}
