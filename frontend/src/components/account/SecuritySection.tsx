'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  changePassword,
  requestEmailChange,
  type Account,
} from '@/lib/account';
import { tokenStorage } from '@/lib/auth';

type Status = { kind: 'ok' | 'error'; text: string } | null;

const PASSWORD_RULES = [
  'Al menos 8 caracteres',
  'Una mayúscula, una minúscula y un número',
];

function inputClass(invalid: boolean) {
  return `w-full px-space-md py-3 rounded-xl bg-surface-container-low text-on-surface border outline-none ${
    invalid ? 'border-error' : 'border-outline-variant focus:ring-2 focus:ring-primary/40'
  }`;
}

export default function SecuritySection({ account }: { account: Account }) {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailStatus, setEmailStatus] = useState<Status>(null);
  const [savingEmail, setSavingEmail] = useState(false);

  const repeatMismatch = repeatPassword !== '' && repeatPassword !== newPassword;
  const passwordReady =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === repeatPassword &&
    !repeatMismatch;

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordStatus(null);

    const result = await changePassword({ currentPassword, newPassword });

    setSavingPassword(false);

    if (result.status !== 'ok') {
      setPasswordStatus({ kind: 'error', text: result.message });
      return;
    }

    // El backend revoca todas las sesiones, así que la de este dispositivo deja
    // de servir. Se limpia el token y se vuelve al login con el aviso a mano.
    tokenStorage.clear();
    router.replace('/login?motivo=clave');
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    setSavingEmail(true);
    setEmailStatus(null);

    const result = await requestEmailChange({ newEmail, currentPassword: emailPassword });

    setSavingEmail(false);

    if (result.status === 'ok') {
      setEmailStatus({ kind: 'ok', text: result.data.message });
      setNewEmail('');
      setEmailPassword('');
      return;
    }

    setEmailStatus({ kind: 'error', text: result.message });
  }

  return (
    <section aria-labelledby="seguridad-title" className="space-y-8">
      <h2 id="seguridad-title" className="text-title-lg font-semibold">
        Seguridad
      </h2>

      <form onSubmit={submitPassword} className="space-y-3 max-w-md">
        <h3 className="text-title-md font-medium">Contraseña</h3>

        <label htmlFor="current-password" className="block text-body-sm text-on-surface-variant">
          Contraseña actual
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={`${inputClass(false)} mt-1`}
            required
          />
        </label>

        <label htmlFor="new-password" className="block text-body-sm text-on-surface-variant">
          Nueva contraseña
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className={`${inputClass(false)} mt-1`}
            required
          />
        </label>

        <label htmlFor="repeat-password" className="block text-body-sm text-on-surface-variant">
          Repite la nueva contraseña
          <input
            id="repeat-password"
            type="password"
            autoComplete="new-password"
            value={repeatPassword}
            onChange={(event) => setRepeatPassword(event.target.value)}
            className={`${inputClass(repeatMismatch)} mt-1`}
            aria-invalid={repeatMismatch}
            required
          />
        </label>

        {repeatMismatch && (
          <p role="alert" className="text-body-sm text-error">
            Las contraseñas no coinciden.
          </p>
        )}

        <ul className="text-body-sm text-on-surface-variant list-disc pl-5">
          {PASSWORD_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>

        {passwordStatus && (
          <p role="alert" className="text-body-sm text-error">
            {passwordStatus.text}
          </p>
        )}

        <p className="text-body-sm text-on-surface-variant">
          Al cambiarla se cerrarán todas tus sesiones, incluido este dispositivo.
        </p>

        <button
          type="submit"
          disabled={!passwordReady || savingPassword}
          className="px-space-md py-2 rounded-full bg-primary text-on-primary text-label-md font-medium disabled:opacity-50"
        >
          {savingPassword ? 'Cambiando…' : 'Cambiar contraseña'}
        </button>
      </form>

      <form onSubmit={submitEmail} className="space-y-3 max-w-md border-t border-outline-variant pt-6">
        <h3 className="text-title-md font-medium">Correo electrónico</h3>

        <p className="text-body-sm text-on-surface-variant">
          Ahora usas <strong>{account.email}</strong>
          {account.isEmailVerified ? ' (verificado)' : ' (sin verificar)'}. Te enviaremos un enlace al
          correo nuevo: el cambio no se aplica hasta que lo confirmes.
        </p>

        <label htmlFor="new-email" className="block text-body-sm text-on-surface-variant">
          Correo nuevo
          <input
            id="new-email"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            className={`${inputClass(false)} mt-1`}
            required
          />
        </label>

        <label htmlFor="email-password" className="block text-body-sm text-on-surface-variant">
          Tu contraseña actual
          <input
            id="email-password"
            type="password"
            autoComplete="current-password"
            value={emailPassword}
            onChange={(event) => setEmailPassword(event.target.value)}
            className={`${inputClass(false)} mt-1`}
            required
          />
        </label>

        {emailStatus && (
          <p
            role="status"
            className={`text-body-sm ${emailStatus.kind === 'ok' ? 'text-on-surface-variant' : 'text-error'}`}
          >
            {emailStatus.text}
          </p>
        )}

        <button
          type="submit"
          disabled={savingEmail || newEmail.length === 0 || emailPassword.length === 0}
          className="px-space-md py-2 rounded-full border border-outline-variant text-label-md font-medium hover:bg-surface-container disabled:opacity-50"
        >
          {savingEmail ? 'Enviando…' : 'Cambiar correo'}
        </button>
      </form>
    </section>
  );
}
