'use client';

import { useState } from 'react';
import { savePreferences, type Account, type AccountPreferences } from '@/lib/account';
import Icon from '@/components/wy/Icon';

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
    preferences.readingSize !== account.preferences.readingSize;

  async function save() {
    setSaving(true);
    setStatus(null);

    const result = await savePreferences({
      theme: preferences.theme,
      pushNotifications: preferences.pushNotifications,
      emailNotifications: preferences.emailNotifications,
      notificationsEnabled: preferences.notificationsEnabled,
      readingSize: preferences.readingSize,
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
