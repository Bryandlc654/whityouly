'use client';

import { useRouter } from 'next/navigation';
import Icon from '@/components/wy/Icon';
import SettingsPage from '@/components/account/SettingsPage';
import NotificationToggle from '@/components/account/NotificationToggle';
import { logout as endSession } from '@/lib/auth';
import { useI18n } from '@/components/providers/I18nProvider';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { t } = useI18n();

  const logout = async () => {
    await endSession();
    router.push('/login');
  };

  return (
    <SettingsPage showBack={false} title={t('settings.title')} copy={t('settings.copy')}>
      {(account, character, reload) => (
        <>
          <section className="settings-hero card">
            <span>
              <Icon name="shield" />
            </span>
            <div>
              <b>{t('settings.identity.title')}</b>
              <p>{t('settings.identity.copy', { name: character?.name ?? t('feed.guest') })}</p>
            </div>
          </section>

          <h2 className="settings-section-title">{t('settings.accountSection')}</h2>
          <section className="settings-list card">
            <button className="settings-row" type="button" onClick={() => router.push('/perfil/editar')}>
              <span>
                <Icon name="user" />
              </span>
              <span>
                <b>{t('settings.profile')}</b>
                <small>{t('settings.profileCopy')}</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
            <button className="settings-row" type="button" onClick={() => router.push('/cuenta/seguridad')}>
              <span>
                <Icon name="lock" />
              </span>
              <span>
                <b>{t('settings.security')}</b>
                <small>{t('settings.securityCopy')}</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
            <NotificationToggle account={account} onSaved={() => void reload()} />
            <button className="settings-row" type="button" onClick={() => router.push('/cuenta/preferencias')}>
              <span>
                <Icon name="settings" />
              </span>
              <span>
                <b>{t('settings.preferences')}</b>
                <small>{t('settings.preferencesCopy')}</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
            <button className="settings-row" type="button" onClick={() => router.push('/cuenta/lectura')}>
              <span>
                <Icon name="book" />
              </span>
              <span>
                <b>{t('settings.reading')}</b>
                <small>{t('settings.readingCopy')}</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
          </section>

          <h2 className="settings-section-title">{t('settings.privacySection')}</h2>
          <section className="settings-list card">
            <button className="settings-row" type="button" onClick={() => router.push('/cuenta/privacidad-datos')}>
              <span>
                <Icon name="shield" />
              </span>
              <span>
                <b>{t('settings.privacyData')}</b>
                <small>{t('settings.privacyDataCopy')}</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
            <button className="settings-row" type="button" onClick={() => router.push('/cuenta/contenido')}>
              <span>
                <Icon name="eye" />
              </span>
              <span>
                <b>{t('settings.content')}</b>
                <small>{t('settings.contentCopy')}</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
            <button className="settings-row" type="button" onClick={() => router.push('/cuenta/bloqueados')}>
              <span>
                <Icon name="users" />
              </span>
              <span>
                <b>{t('settings.blocked')}</b>
                <small>{t('settings.blockedCopy')}</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
            <button className="settings-row" type="button" onClick={() => router.push('/mis-reportes')}>
              <span>
                <Icon name="flag" />
              </span>
              <span>
                <b>{t('settings.reports')}</b>
                <small>{t('settings.reportsCopy')}</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
          </section>

          <section className="settings-list card">
            <button className="settings-row logout-row" type="button" onClick={() => void logout()}>
              <span>
                <Icon name="user" />
              </span>
              <span>
                <b>{t('settings.logout')}</b>
                <small>{t('settings.logoutCopy')}</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
          </section>
        </>
      )}
    </SettingsPage>
  );
}
