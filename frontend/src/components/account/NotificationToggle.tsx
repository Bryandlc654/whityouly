'use client';

import { useState } from 'react';
import { savePreferences, type Account } from '@/lib/account';
import Icon from '@/components/wy/Icon';

interface Props {
  account: Account;
  onSaved: () => void;
}

export default function NotificationToggle({ account, onSaved }: Props) {
  const [enabled, setEnabled] = useState(account.preferences.notificationsEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const change = async (next: boolean) => {
    if (busy) return;

    setEnabled(next);
    setBusy(true);
    setError('');

    const result = await savePreferences({ notificationsEnabled: next });
    setBusy(false);

    if (result.status !== 'ok') {
      setEnabled(!next);
      setError(result.message);
      return;
    }

    onSaved();
  };

  return (
    <label className="settings-row">
      <span>
        <Icon name="bell" />
      </span>
      <span>
        <b>Notificaciones respetuosas</b>
        <small>Sin texto emocional en la pantalla bloqueada</small>
        {error ? (
          <small className="auth-error" role="alert">
            {error}
          </small>
        ) : null}
      </span>
      <span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(event) => void change(event.target.checked)}
        />
      </span>
    </label>
  );
}
