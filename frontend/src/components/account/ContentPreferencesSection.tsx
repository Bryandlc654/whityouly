'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/wy/Icon';
import {
  listAuthorPreferences,
  removeAuthorPreference,
  type AuthorPreference,
} from '@/lib/contentPreferences';

const LABELS = {
  MUTE: 'Silenciado',
  BLOCK: 'Bloqueado',
  LESS: 'Ver menos',
} as const;

export default function ContentPreferencesSection() {
  const [items, setItems] = useState<AuthorPreference[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const result = await listAuthorPreferences();
    if (result.status === 'ok') {
      setItems(result.data);
      setError('');
    } else {
      setError(result.message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <label className="field-label">Contenido de autores</label>
      <p className="muted small" style={{ marginTop: 0 }}>
        Puedes silenciar, bloquear o ver menos contenido desde el menú de cada relato.
      </p>
      {error ? (
        <p className="auth-error" role="alert">
          {error}{' '}
          <button className="text-link" type="button" onClick={() => void load()}>
            Reintentar
          </button>
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="hint">No has silenciado ni bloqueado a ningún autor.</p>
      ) : (
        <div className="settings-list">
          {items.map((item) => (
            <div key={item.id} className="settings-row">
              <span>
                <Icon name={item.kind === 'BLOCK' ? 'lock' : item.kind === 'LESS' ? 'trend' : 'eye'} />
              </span>
              <span>
                <b>{item.authorName}</b>
                <small>{LABELS[item.kind]}</small>
              </span>
              <span>
                <button
                  className="text-link"
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => {
                    setBusyId(item.id);
                    void removeAuthorPreference(item.id).then((result) => {
                      setBusyId(null);
                      if (result.status !== 'ok') {
                        setError(result.message);
                        return;
                      }
                      setItems((prev) => prev.filter((row) => row.id !== item.id));
                    });
                  }}
                >
                  Quitar
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
