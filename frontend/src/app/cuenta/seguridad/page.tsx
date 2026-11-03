'use client';

import SettingsPage from '@/components/account/SettingsPage';
import SecuritySection from '@/components/account/SecuritySection';
import SessionsSection from '@/components/account/SessionsSection';

export default function SecurityPage() {
  return (
    <SettingsPage
      title="Cuenta y seguridad"
      copy="Administra el acceso sin exponer tu identidad pública."
    >
      {(account) => (
        <>
          <SecuritySection account={account} />
          <SessionsSection />
        </>
      )}
    </SettingsPage>
  );
}
