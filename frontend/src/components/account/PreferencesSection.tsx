'use client';

import { useState } from 'react';
import { savePreferences, type Account, type AccountPreferences } from '@/lib/account';

interface Props {
  account: Account;
  onSaved: (account: Account) => void;
}

const THEMES = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Según el sistema' },
];

export default function PreferencesSection({ account, onSaved }: Props) {
  const [preferences, setPreferences] = useState<AccountPreferences>(account.preferences);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    preferences.theme !== account.preferences.theme ||
    preferences.pushNotifications !== account.preferences.pushNotifications ||
    preferences.emailNotifications !== account.preferences.emailNotifications;

  async function save() {
    setSaving(true);
    setStatus(null);

    const result = await savePreferences({
      theme: preferences.theme,
      pushNotifications: preferences.pushNotifications,
      emailNotifications: preferences.emailNotifications,
    });

    setSaving(false);

    if (result.status === 'ok') {
      onSaved({ ...account, preferences: { ...preferences, ...result.data } });
      setStatus({ kind: 'ok', text: 'Preferencias guardadas.' });
      return;
    }

    // Se restauran los valores del servidor: si el guardado falló, la pantalla
    // no debe seguir mostrando unos cambios que no existen.
    setPreferences(account.preferences);
    setStatus({ kind: 'error', text: result.message });
  }

  return (
    <section aria-labelledby="preferencias-title" className="space-y-6">
      <h2 id="preferencias-title" className="text-title-lg font-semibold">
        Preferencias
      </h2>

      <fieldset className="rounded-2xl bg-surface-container-low p-4 space-y-3">
        <legend className="px-2 text-label-md font-medium text-on-surface-variant">Apariencia</legend>
        {THEMES.map((theme) => (
          <label key={theme.value} className="flex items-center gap-3 text-body-md">
            <input
              type="radio"
              name="theme"
              value={theme.value}
              checked={preferences.theme === theme.value}
              onChange={() => setPreferences((prev) => ({ ...prev, theme: theme.value }))}
              className="accent-primary"
            />
            {theme.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="rounded-2xl bg-surface-container-low p-4 space-y-3">
        <legend className="px-2 text-label-md font-medium text-on-surface-variant">Avisos</legend>

        <label className="flex items-start gap-3 text-body-md">
          <input
            type="checkbox"
            checked={preferences.emailNotifications}
            onChange={(event) =>
              setPreferences((prev) => ({ ...prev, emailNotifications: event.target.checked }))
            }
            className="mt-1 accent-primary"
          />
          <span>
            Avisarme por correo
            <span className="block text-body-sm text-on-surface-variant">
              Nuevos seguidores, reacciones y comentarios.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-body-md">
          <input
            type="checkbox"
            checked={preferences.pushNotifications}
            onChange={(event) =>
              setPreferences((prev) => ({ ...prev, pushNotifications: event.target.checked }))
            }
            className="mt-1 accent-primary"
          />
          <span>
            Notificaciones en el navegador
            <span className="block text-body-sm text-on-surface-variant">
              Requiere que las tengas permitidas en el navegador.
            </span>
          </span>
        </label>
      </fieldset>

      {status && (
        <p
          role="status"
          className={
            status.kind === 'ok'
              ? 'text-body-sm text-on-surface-variant'
              : 'text-body-sm text-error'
          }
        >
          {status.text}
        </p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={!dirty || saving}
        className="px-space-md py-2 rounded-full bg-primary text-on-primary text-label-md font-medium disabled:opacity-50"
      >
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </section>
  );
}
