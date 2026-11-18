'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  changePassword,
  disableMfa,
  enableMfa,
  fetchMfaStatus,
  requestEmailChange,
  setupMfa,
  type Account,
  type MfaStatus,
} from '@/lib/account';
import { tokenStorage } from '@/lib/auth';

type Status = { kind: 'ok' | 'error'; text: string } | null;

const PASSWORD_RULES = [
  'Al menos 8 caracteres',
  'Una mayúscula, una minúscula y un número',
];

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

  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaStatus, setMfaStatus] = useState<Status>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

  useEffect(() => {
    void fetchMfaStatus().then((result) => {
      if (result.status === 'ok') setMfa(result.data);
    });
  }, []);

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

  async function startMfaSetup() {
    setMfaBusy(true);
    setMfaStatus(null);
    const result = await setupMfa();
    setMfaBusy(false);
    if (result.status !== 'ok') {
      setMfaStatus({ kind: 'error', text: result.message });
      return;
    }
    setMfaSetup(result.data);
  }

  async function confirmMfaSetup(event: React.FormEvent) {
    event.preventDefault();
    setMfaBusy(true);
    setMfaStatus(null);
    const result = await enableMfa(mfaCode);
    setMfaBusy(false);
    if (result.status !== 'ok') {
      setMfaStatus({ kind: 'error', text: result.message });
      return;
    }
    setRecoveryCodes(result.data.recoveryCodes);
    setMfa({ enabled: true, recoveryCodesRemaining: result.data.recoveryCodes.length });
    setMfaSetup(null);
    setMfaCode('');
    setMfaStatus({ kind: 'ok', text: 'Verificación en dos pasos activada.' });
  }

  async function submitDisableMfa(event: React.FormEvent) {
    event.preventDefault();
    setMfaBusy(true);
    setMfaStatus(null);
    const result = await disableMfa({ password: disablePassword, code: disableCode });
    setMfaBusy(false);
    if (result.status !== 'ok') {
      setMfaStatus({ kind: 'error', text: result.message });
      return;
    }
    setMfa({ enabled: false, recoveryCodesRemaining: 0 });
    setDisablePassword('');
    setDisableCode('');
    setRecoveryCodes(null);
    setMfaStatus({ kind: 'ok', text: 'Verificación en dos pasos desactivada.' });
  }

  return (
    <section aria-labelledby="seguridad-title" className="stack">
      <form onSubmit={submitPassword} className="card pad stack">
        <div>
          <h2 id="seguridad-title" className="h-section">
            Seguridad
          </h2>
          <label className="field-label">Contraseña</label>
        </div>

        <label className="field-label" style={{ marginTop: 0 }}>
          Contraseña actual
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>

        <label className="field-label" style={{ marginTop: 0 }}>
          Nueva contraseña
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </label>

        <label className="field-label" style={{ marginTop: 0 }}>
          Repite la nueva contraseña
          <input
            className={`field ${repeatMismatch ? 'field-error' : ''}`}
            type="password"
            autoComplete="new-password"
            value={repeatPassword}
            onChange={(event) => setRepeatPassword(event.target.value)}
            aria-invalid={repeatMismatch}
            required
          />
        </label>

        {repeatMismatch ? (
          <p role="alert" className="auth-error" style={{ margin: 0 }}>
            Las contraseñas no coinciden.
          </p>
        ) : null}

        <div className="tip">
          <b>Requisitos:</b> {PASSWORD_RULES.join(' · ')}.
        </div>

        {passwordStatus ? (
          <p role="alert" className="auth-error" style={{ margin: 0 }}>
            {passwordStatus.text}
          </p>
        ) : null}

        <p className="hint" style={{ margin: 0 }}>
          Al cambiarla se cerrarán todas tus sesiones, incluido este dispositivo.
        </p>

        <div>
          <button type="submit" className="primary" disabled={!passwordReady || savingPassword}>
            {savingPassword ? 'Cambiando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>

      <div className="card pad stack">
        <div>
          <h2 className="h-section">Verificación en dos pasos</h2>
          <p className="hint" style={{ margin: 0 }}>
            Protege tu cuenta con un código temporal de tu aplicación de autenticación. Es
            obligatoria para acceder al panel de superadministración.
          </p>
        </div>

        {mfaStatus ? (
          <p
            role="status"
            className={mfaStatus.kind === 'ok' ? 'auth-success' : 'auth-error'}
            style={{ margin: 0 }}
          >
            {mfaStatus.text}
          </p>
        ) : null}

        {mfa?.enabled ? (
          <form onSubmit={submitDisableMfa} className="stack">
            <p className="hint" style={{ margin: 0 }}>
              Activada. Códigos de recuperación restantes: <b>{mfa.recoveryCodesRemaining}</b>.
            </p>
            <label className="field-label" style={{ marginTop: 0 }}>
              Contraseña actual
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                value={disablePassword}
                onChange={(event) => setDisablePassword(event.target.value)}
                required
              />
            </label>
            <label className="field-label" style={{ marginTop: 0 }}>
              Código de 6 dígitos
              <input
                className="field"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
                required
              />
            </label>
            <div>
              <button
                type="submit"
                className="btn-outline"
                disabled={mfaBusy || !disablePassword || disableCode.length < 6}
              >
                {mfaBusy ? 'Desactivando…' : 'Desactivar verificación en dos pasos'}
              </button>
            </div>
          </form>
        ) : mfaSetup ? (
          <form onSubmit={confirmMfaSetup} className="stack">
            <p className="hint" style={{ margin: 0 }}>
              Añade este secreto a tu aplicación de autenticación y confirma el código que
              genere:
            </p>
            <code style={{ wordBreak: 'break-all' }}>{mfaSetup.secret}</code>
            <p className="hint" style={{ margin: 0, wordBreak: 'break-all' }}>
              {mfaSetup.otpauthUrl}
            </p>
            <label className="field-label" style={{ marginTop: 0 }}>
              Código de 6 dígitos
              <input
                className="field"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
                required
              />
            </label>
            <div>
              <button type="submit" className="primary" disabled={mfaBusy || mfaCode.length < 6}>
                {mfaBusy ? 'Activando…' : 'Activar verificación en dos pasos'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <button type="button" className="primary" onClick={startMfaSetup} disabled={mfaBusy}>
              {mfaBusy ? 'Generando…' : 'Activar verificación en dos pasos'}
            </button>
          </div>
        )}

        {recoveryCodes ? (
          <div className="tip">
            <b>Guarda estos códigos de recuperación.</b> No se volverán a mostrar:
            <ul style={{ margin: '8px 0 0', columns: 2 }}>
              {recoveryCodes.map((code) => (
                <li key={code} style={{ fontFamily: 'monospace' }}>
                  {code}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <form onSubmit={submitEmail} className="card pad stack">
        <div>
          <h2 className="h-section">Correo electrónico</h2>
          <p className="hint" style={{ margin: 0 }}>
            Ahora usas <strong>{account.email}</strong>
            {account.isEmailVerified ? ' (verificado)' : ' (sin verificar)'}. Te enviaremos un enlace
            al correo nuevo: el cambio no se aplica hasta que lo confirmes.
          </p>
        </div>

        <label className="field-label" style={{ marginTop: 0 }}>
          Correo nuevo
          <input
            className="field"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            required
          />
        </label>

        <label className="field-label" style={{ marginTop: 0 }}>
          Tu contraseña actual
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={emailPassword}
            onChange={(event) => setEmailPassword(event.target.value)}
            required
          />
        </label>

        {emailStatus ? (
          <p
            role="status"
            className={emailStatus.kind === 'ok' ? 'auth-success' : 'auth-error'}
            style={{ margin: 0 }}
          >
            {emailStatus.text}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            className="btn-outline"
            disabled={savingEmail || newEmail.length === 0 || emailPassword.length === 0}
          >
            {savingEmail ? 'Enviando…' : 'Cambiar correo'}
          </button>
        </div>
      </form>
    </section>
  );
}
