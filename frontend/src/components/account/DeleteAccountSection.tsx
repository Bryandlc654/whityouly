'use client';

import { useState } from 'react';
import {
  cancelAccountDeletion,
  requestAccountDeletion,
  type Account,
} from '@/lib/account';
import Icon from '@/components/wy/Icon';

const CONFIRMATION_WORD = 'ELIMINAR';
const GRACE_DAYS = 30;

interface Props {
  account: Account;
  onReload: () => void | Promise<void>;
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function DeleteAccountSection({ account, onReload }: Props) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const deletion = account.deletion;
  const pending = Boolean(deletion) || account.status === 'DELETION_PENDING';
  const ready = password.length > 0 && confirmation.trim().toUpperCase() === CONFIRMATION_WORD;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');
    setNotice('');

    const result = await requestAccountDeletion({
      currentPassword: password,
      confirmation,
    });

    setBusy(false);

    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }

    setPassword('');
    setConfirmation('');
    setNotice(result.data.message);
    await onReload();
  }

  async function cancel() {
    if (busy) return;

    setBusy(true);
    setError('');
    setNotice('');

    const result = await cancelAccountDeletion();
    setBusy(false);

    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }

    setNotice(result.data.message);
    await onReload();
  }

  if (pending) {
    return (
      <section aria-labelledby="baja-title" className="card pad stack">
        <div>
          <h2 id="baja-title" className="h-section" style={{ color: 'var(--red)' }}>
            Baja programada
          </h2>
          <p className="hint" style={{ margin: 0 }}>
            {deletion
              ? `Tu cuenta y tus datos se eliminarán el ${formatDate(deletion.eligibleAt)}. Hasta entonces puedes cancelar la solicitud.`
              : 'Tu cuenta tiene una baja pendiente. Puedes cancelarla para seguir usándola.'}
          </p>
        </div>

        {notice ? (
          <p className="auth-success" role="status" style={{ margin: 0 }}>
            {notice}
          </p>
        ) : null}

        {error ? (
          <p className="auth-error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        ) : null}

        <div className="tip">
          <Icon name="shield" /> Cancelar la baja reactiva la cuenta y conserva todo tu contenido.
        </div>

        <div>
          <button className="primary" type="button" onClick={() => void cancel()} disabled={busy}>
            {busy ? 'Cancelando…' : 'Cancelar solicitud de baja'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="baja-title" className="card pad stack">
      <div>
        <h2 id="baja-title" className="h-section" style={{ color: 'var(--red)' }}>
          Dar de baja la cuenta
        </h2>
        <p className="hint" style={{ margin: 0 }}>
          La cuenta no se elimina de inmediato: queda en un periodo reversible de{' '}
          {GRACE_DAYS} días. Durante ese tiempo puedes cancelar la solicitud desde esta
          misma pantalla.
        </p>
      </div>

      <div className="tip">
        <Icon name="lock" /> Al finalizar el periodo se eliminan tu perfil, relatos,
        comentarios, datos privados y archivos. La acción no se puede deshacer.
      </div>

      <div className="tip">
        <Icon name="book" /> Descarga una copia de tus datos antes de continuar desde
        Configuración → Tus datos.
      </div>

      {notice ? (
        <p className="auth-success" role="status" style={{ margin: 0 }}>
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="auth-error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}

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

        <div>
          <button type="submit" className="btn-danger" disabled={!ready || busy}>
            {busy ? 'Solicitando…' : 'Solicitar baja reversible'}
          </button>
        </div>
      </form>
    </section>
  );
}
