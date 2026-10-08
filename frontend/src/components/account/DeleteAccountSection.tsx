'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAccount } from '@/lib/account';
import { tokenStorage } from '@/lib/auth';
import Icon from '@/components/wy/Icon';

const CONFIRMATION_WORD = 'ELIMINAR';

export default function DeleteAccountSection() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const ready = password.length > 0 && confirmation.trim().toUpperCase() === CONFIRMATION_WORD;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setDeleting(true);
    setError('');

    const result = await deleteAccount({ currentPassword: password, confirmation });

    setDeleting(false);

    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }

    // La baja revoca las sesiones: el token local ya no sirve para nada.
    tokenStorage.clear();
    router.replace('/login?motivo=baja');
  }

  return (
    <section aria-labelledby="baja-title" className="card pad stack">
      <div>
        <h2 id="baja-title" className="h-section" style={{ color: 'var(--red)' }}>
          Dar de baja la cuenta
        </h2>
        <p className="hint" style={{ margin: 0 }}>
          Tu cuenta dejará de permitir el inicio de sesión y se cerrarán todas tus sesiones. Tus
          relatos, comentarios y música se conservan para que no se rompa lo que han publicado otras
          personas.
        </p>
      </div>

      <div className="tip">
        <Icon name="lock" /> Esta acción es irreversible una vez confirmada.
      </div>

      <form onSubmit={submit} className="stack">
        <label className="field-label" style={{ marginTop: 0 }}>
          Tu contraseña
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label className="field-label" style={{ marginTop: 0 }}>
          Escribe {CONFIRMATION_WORD} para confirmar
          <input
            className="field"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </label>

        {error ? (
          <p role="alert" className="auth-error" style={{ margin: 0 }}>
            {error}
          </p>
        ) : null}

        <div>
          <button type="submit" className="btn-danger" disabled={!ready || deleting}>
            {deleting ? 'Dando de baja…' : 'Dar de baja mi cuenta'}
          </button>
        </div>
      </form>
    </section>
  );
}
