'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';

interface StepUpDetail {
  resolve: (token: string | null) => void;
}

/**
 * Diálogo único para las acciones administrativas que exigen step-up MFA.
 * `adminFetch` espera aquí mientras la persona introduce el código.
 */
export default function AdminStepUp() {
  const resolver = useRef<((token: string | null) => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [enroll, setEnroll] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onStepUp = (event: Event) => {
      const detail = (event as CustomEvent<StepUpDetail>).detail;
      resolver.current = detail.resolve;
      setCode('');
      setError('');
      setOpen(true);
    };
    const onEnroll = () => setEnroll(true);

    window.addEventListener('withyouly:step-up-required', onStepUp);
    window.addEventListener('withyouly:mfa-enroll-required', onEnroll);
    return () => {
      window.removeEventListener('withyouly:step-up-required', onStepUp);
      window.removeEventListener('withyouly:mfa-enroll-required', onEnroll);
    };
  }, []);

  const close = useCallback((token: string | null) => {
    resolver.current?.(token);
    resolver.current = null;
    setOpen(false);
    setBusy(false);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await authFetch(`${API_URL}/auth/mfa/step-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        setError('El código no es válido o expiró. Inténtalo de nuevo.');
        setBusy(false);
        return;
      }
      const data = (await response.json()) as { stepUpToken: string };
      close(data.stepUpToken);
    } catch {
      setError('No se pudo contactar con el servidor.');
      setBusy(false);
    }
  };

  if (enroll && !open) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Activar verificación en dos pasos"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 12, 25, 0.55)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 80,
          padding: 20,
        }}
      >
        <div className="card pad stack" style={{ maxWidth: 460 }}>
          <h2 className="h-section">Activa la verificación en dos pasos</h2>
          <p className="hint">
            El panel de superadministración exige MFA. Actívala en Cuenta → Seguridad y vuelve a
            entrar.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <a className="primary" href="/cuenta/seguridad">
              Ir a Seguridad
            </a>
            <button type="button" className="btn-outline" onClick={() => setEnroll(false)}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar acción administrativa"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 12, 25, 0.55)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 80,
        padding: 20,
      }}
    >
      <form className="card pad stack" onSubmit={submit} style={{ maxWidth: 420, width: '100%' }}>
        <h2 className="h-section">Confirma la acción</h2>
        <p className="hint" style={{ margin: 0 }}>
          Introduce el código de tu aplicación de autenticación. La autorización dura 5 minutos.
        </p>
        <input
          className="field"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="123456"
          required
        />
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="primary" disabled={busy || code.length < 6}>
            {busy ? 'Comprobando…' : 'Confirmar'}
          </button>
          <button type="button" className="btn-outline" onClick={() => close(null)} disabled={busy}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
