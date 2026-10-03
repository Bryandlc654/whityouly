'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAccount } from '@/lib/account';
import { tokenStorage } from '@/lib/auth';

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
    <section aria-labelledby="baja-title" className="space-y-4 max-w-md">
      <h2 id="baja-title" className="text-title-lg font-semibold text-error">
        Dar de baja la cuenta
      </h2>

      <p className="text-body-md text-on-surface-variant">
        Tu cuenta dejará de permitir el inicio de sesión y se cerrarán todas tus sesiones. Tus
        relatos, comentarios y música se conservan para que no se rompa lo que han publicado otras
        personas.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="delete-password" className="block text-body-sm text-on-surface-variant">
          Tu contraseña
          <input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full px-space-md py-3 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant focus:ring-2 focus:ring-primary/40 outline-none mt-1"
            required
          />
        </label>

        <label htmlFor="delete-confirmation" className="block text-body-sm text-on-surface-variant">
          Escribe {CONFIRMATION_WORD} para confirmar
          <input
            id="delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="w-full px-space-md py-3 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant focus:ring-2 focus:ring-primary/40 outline-none mt-1"
            required
          />
        </label>

        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready || deleting}
          className="px-space-md py-2 rounded-full bg-error text-on-error text-label-md font-medium disabled:opacity-50"
        >
          {deleting ? 'Dando de baja…' : 'Dar de baja mi cuenta'}
        </button>
      </form>
    </section>
  );
}
