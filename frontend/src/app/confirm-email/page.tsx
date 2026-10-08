'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmEmailChange } from '@/lib/account';
import AuthCard from '@/components/wy/AuthCard';
import Icon from '@/components/wy/Icon';

function ConfirmEmailLogic() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmando tu nuevo correo…');

  const token = useSearchParams().get('token');
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('El enlace es inválido o no existe.');
      return;
    }

    const confirm = async () => {
      const result = await confirmEmailChange(token);

      if (result.status !== 'ok') {
        setStatus('error');
        setMessage(result.message);
        return;
      }

      setStatus('success');
      setMessage(result.data.message);
    };

    void confirm();
  }, [token]);

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
          <h1>¡Correo actualizado!</h1>
          <p className="auth-note">{message}</p>
          <button className="primary" type="button" onClick={() => router.push('/login')}>
            Iniciar sesión
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="status-icon err">
            <Icon name="x" />
          </div>
          <h1>No se pudo confirmar</h1>
          <p className="auth-note">{message}</p>
          <button className="primary" type="button" onClick={() => router.push('/cuenta')}>
            Volver a mi cuenta
          </button>
        </>
      )}
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <AuthCard>
      <Suspense fallback={<p className="auth-note">Cargando…</p>}>
        <ConfirmEmailLogic />
      </Suspense>
    </AuthCard>
  );
}
