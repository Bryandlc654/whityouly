'use client';

import { useState } from 'react';
import { savePreferences, type Account, type AccountPreferences } from '@/lib/account';
import Icon from '@/components/wy/Icon';
import { COUNTRIES, LANGUAGES } from '@/lib/locales';

interface Props {
  account: Account;
  onSaved: (account: Account) => void;
}

const THEMES = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Según el sistema' },
];

const READING_SIZES: { value: AccountPreferences['readingSize']; label: string }[] = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LARGE', label: 'Grande' },
  { value: 'LARGER', label: 'Más grande' },
];

export default function PreferencesSection({ account, onSaved }: Props) {
  const [preferences, setPreferences] = useState<AccountPreferences>(account.preferences);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    preferences.theme !== account.preferences.theme ||
    preferences.pushNotifications !== account.preferences.pushNotifications ||
    preferences.emailNotifications !== account.preferences.emailNotifications ||
    preferences.notificationsEnabled !== account.preferences.notificationsEnabled ||
    preferences.readingSize !== account.preferences.readingSize ||
    preferences.language !== account.preferences.language ||
    preferences.countryCode !== account.preferences.countryCode;

  async function save() {
    setSaving(true);
    setStatus(null);

    const result = await savePreferences({
      theme: preferences.theme,
      pushNotifications: preferences.pushNotifications,
      emailNotifications: preferences.emailNotifications,
      notificationsEnabled: preferences.notificationsEnabled,
      readingSize: preferences.readingSize,
      language: preferences.language,
      countryCode: preferences.countryCode,
    });

    setSaving(false);

    if (result.status === 'ok') {
      onSaved({ ...account, preferences: { ...preferences, ...result.data } });
      window.dispatchEvent(
        new CustomEvent('withyouly:reading-size', {
          detail: result.data.readingSize ?? preferences.readingSize,
        }),
      );
      setStatus({ kind: 'ok', text: 'Preferencias guardadas.' });
      return;
    }

    // Se restauran los valores del servidor: si el guardado falló, la pantalla
    // no debe seguir mostrando unos cambios que no existen.
    setPreferences(account.preferences);
    setStatus({ kind: 'error', text: result.message });
  }

  return (
    <section aria-labelledby="preferencias-title" className="card pad stack">
      <div>
        <h2 id="preferencias-title" className="h-section">
          Preferencias
        </h2>

        <label className="field-label">Apariencia</label>
        <div className="segmented">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              type="button"
              className={preferences.theme === theme.value ? 'active' : undefined}
              aria-pressed={preferences.theme === theme.value}
              onClick={() => setPreferences((prev) => ({ ...prev, theme: theme.value }))}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="preferenceLanguage">Idioma preferido</label>
        <p className="hint" style={{ margin: '0 0 8px' }}>
          Se usa para las traducciones disponibles y como idioma inicial de tus nuevos relatos.
        </p>
        <select
          id="preferenceLanguage"
          value={preferences.language}
          onChange={(event) => setPreferences((prev) => ({ ...prev, language: event.target.value }))}
          style={{ width: '100%', minHeight: 44, padding: '9px 11px', border: '1px solid #b9bdc6', borderRadius: 11 }}
        >
          {LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>{language.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="preferenceCountry">País (opcional)</label>
        <p className="hint" style={{ margin: '0 0 8px' }}>
          Se añade como dato opcional a tus próximos relatos. No aparece junto a tu seudónimo.
        </p>
        <select
          id="preferenceCountry"
          value={preferences.countryCode ?? ''}
          onChange={(event) => setPreferences((prev) => ({ ...prev, countryCode: event.target.value || null }))}
          style={{ width: '100%', minHeight: 44, padding: '9px 11px', border: '1px solid #b9bdc6', borderRadius: 11 }}
        >
          <option value="">Sin país</option>
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>{country.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label">Lectura</label>
        <p className="hint" style={{ margin: '0 0 8px' }}>
          Ajusta el tamaño de los relatos, etapas y comentarios.
        </p>
        <div className="segmented">
          {READING_SIZES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={preferences.readingSize === option.value ? 'active' : undefined}
              aria-pressed={preferences.readingSize === option.value}
              onClick={() =>
                setPreferences((prev) => ({ ...prev, readingSize: option.value }))
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="field-label">Avisos</label>
        <div className="settings-list">
          <label className="settings-row">
            <span>
              <Icon name="bell" />
            </span>
            <span>
              <b>Avisos dentro de la app</b>
              <small>Seguidores, comentarios y etapas de relatos que sigues.</small>
            </span>
            <span>
              <input
                type="checkbox"
                checked={preferences.notificationsEnabled}
                onChange={(event) =>
                  setPreferences((prev) => ({
                    ...prev,
                    notificationsEnabled: event.target.checked,
                  }))
                }
              />
            </span>
          </label>

          <label className="settings-row">
            <span>
              <Icon name="mail" />
            </span>
            <span>
              <b>Avisarme por correo</b>
              <small>Nuevos seguidores, reacciones y comentarios.</small>
            </span>
            <span>
              <input
                type="checkbox"
                checked={preferences.emailNotifications}
                onChange={(event) =>
                  setPreferences((prev) => ({ ...prev, emailNotifications: event.target.checked }))
                }
              />
            </span>
          </label>

          <label className="settings-row">
            <span>
              <Icon name="bell" />
            </span>
            <span>
              <b>Notificaciones en el navegador</b>
              <small>Requiere que las tengas permitidas en el navegador.</small>
            </span>
            <span>
              <input
                type="checkbox"
                checked={preferences.pushNotifications}
                onChange={(event) =>
                  setPreferences((prev) => ({ ...prev, pushNotifications: event.target.checked }))
                }
              />
            </span>
          </label>
        </div>
      </div>

      {status ? (
        <p
          role="status"
          className={status.kind === 'ok' ? 'auth-success' : 'auth-error'}
          style={{ margin: 0 }}
        >
          {status.text}
        </p>
      ) : null}

      <div>
        <button type="button" className="primary" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </section>
  );
}
