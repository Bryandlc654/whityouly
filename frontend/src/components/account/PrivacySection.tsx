'use client';

import { useState } from 'react';
import { saveCharacterPrivacy } from '@/lib/characters';
import type { PrivacySettings } from '@/components/feed/types';
import Icon from '@/components/wy/Icon';

interface Props {
  settings?: PrivacySettings | null;
  onSaved: (settings: PrivacySettings) => void;
}

const DEFAULTS: PrivacySettings = {
  profileVisibility: 'PUBLIC',
  showAvatar: true,
  showBio: true,
  showFollowing: false,
};

const VISIBILITIES: { value: PrivacySettings['profileVisibility']; label: string; hint: string }[] = [
  { value: 'PUBLIC', label: 'Público', hint: 'Tu perfil aparece en búsquedas y enlaces.' },
  { value: 'PRIVATE', label: 'Privado', hint: 'Tu perfil deja de ser visible para la comunidad.' },
];

export default function PrivacySection({ settings, onSaved }: Props) {
  const initial = { ...DEFAULTS, ...(settings ?? {}) };
  const [values, setValues] = useState<PrivacySettings>(initial);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    values.profileVisibility !== initial.profileVisibility ||
    values.showAvatar !== initial.showAvatar ||
    values.showBio !== initial.showBio ||
    values.showFollowing !== initial.showFollowing;

  async function save() {
    setSaving(true);
    setStatus(null);

    const result = await saveCharacterPrivacy(values);
    setSaving(false);

    if (result.status === 'ok') {
      setValues(result.data);
      onSaved(result.data);
      setStatus({ kind: 'ok', text: 'Ajustes de privacidad guardados.' });
      return;
    }

    setValues(initial);
    setStatus({ kind: 'error', text: result.message });
  }

  return (
    <section aria-labelledby="privacidad-title" className="card pad stack">
      <div>
        <h2 id="privacidad-title" className="h-section">
          Privacidad
        </h2>
        <p className="muted small" style={{ marginTop: 4 }}>
          Tú decides qué información personal comparte la comunidad. Tu correo nunca aparece en el
          perfil público: solo lo ve la persona detrás de tu seudónimo.
        </p>
      </div>

      <div>
        <label className="field-label">Visibilidad del perfil</label>
        <div className="segmented">
          {VISIBILITIES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={values.profileVisibility === option.value ? 'active' : undefined}
              aria-pressed={values.profileVisibility === option.value}
              onClick={() => setValues((prev) => ({ ...prev, profileVisibility: option.value }))}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 6 }}>
          {VISIBILITIES.find((option) => option.value === values.profileVisibility)?.hint}
        </p>
      </div>

      <div>
        <label className="field-label">Qué muestras en tu perfil</label>
        <div className="settings-list">
          <label className="settings-row">
            <span>
              <Icon name="user" />
            </span>
            <span>
              <b>Mostrar mi avatar</b>
              <small>Si lo ocultas, solo se verá tu seudónimo.</small>
            </span>
            <span>
              <input
                type="checkbox"
                checked={values.showAvatar}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, showAvatar: event.target.checked }))
                }
              />
            </span>
          </label>

          <label className="settings-row">
            <span>
              <Icon name="book" />
            </span>
            <span>
              <b>Mostrar mi biografía</b>
              <small>Ocúltala si prefieres no compartir detalles personales.</small>
            </span>
            <span>
              <input
                type="checkbox"
                checked={values.showBio}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, showBio: event.target.checked }))
                }
              />
            </span>
          </label>

          <label className="settings-row">
            <span>
              <Icon name="users" />
            </span>
            <span>
              <b>Mostrar a quién sigo</b>
              <small>Si lo desactivas, solo tú podrás ver tu lista de seguidos.</small>
            </span>
            <span>
              <input
                type="checkbox"
                checked={values.showFollowing}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, showFollowing: event.target.checked }))
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
