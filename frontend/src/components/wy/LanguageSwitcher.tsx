'use client';

import Icon from './Icon';
import { useI18n } from '@/components/providers/I18nProvider';
import type { Language } from '@/lib/i18n/messages';

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <label className={`lang-switch${compact ? ' compact' : ''}`}>
      <Icon name="globe" />
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        aria-label={t('language.label')}
        title={t('language.label')}
      >
        <option value="es">ES</option>
        <option value="en">EN</option>
      </select>
    </label>
  );
}
