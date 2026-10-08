'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import AuthCard from '@/components/wy/AuthCard';
import Icon from '@/components/wy/Icon';

function VerifyEmailLogic() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando tu correo electrónico…');

  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('El enlace de verificación es inválido o no existe.');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(extractErrorMessage(data, 'Error al verificar el correo'));
        }

        setStatus('success');
        setMessage(data.message || '¡Cuenta verificada exitosamente!');

        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Error al verificar el correo');
      }
    };

    verify();
  }, [token, router]);

  return (
    <div className="center">
      {status === 'loading' && (
        <>
          <span className="spin" />
          <p className="auth-note">{message}</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="status-icon ok">
            <Icon name="check" />
          </div>
          <h1>¡Todo listo!</h1>
          <p className="auth-note">{message}</p>
          <p className="auth-note">Redirigiendo al inicio de sesión…</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="status-icon err">
            <Icon name="x" />
          </div>
          <h1>Algo salió mal</h1>
          <p className="auth-note">{message}</p>
          <button className="primary" type="button" onClick={() => router.push('/login')}>
            Volver al inicio de sesión
          </button>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthCard>
      <Suspense fallback={<p className="auth-note">Cargando…</p>}>
        <VerifyEmailLogic />
      </Suspense>
    </AuthCard>
  );
}
