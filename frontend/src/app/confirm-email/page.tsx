'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmEmailChange } from '@/lib/account';

function ConfirmEmailLogic() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmando tu nuevo correo...');

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
    <div className="flex flex-col items-center justify-center text-center">
      {status === 'loading' && (
        <>
          <span className="material-symbols-outlined animate-spin text-primary text-5xl mb-4">
            progress_activity
          </span>
          <p className="text-on-surface-variant text-lg">{message}</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-16 h-16 rounded-full bg-secondary-container text-secondary flex items-center justify-center mb-4 shadow-lg">
            <span className="material-symbols-outlined text-3xl">mark_email_read</span>
          </div>
          <h3 className="text-2xl font-bold text-on-surface mb-2">¡Correo actualizado!</h3>
          <p className="text-on-surface-variant text-lg mb-6">{message}</p>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors"
          >
            Iniciar sesión
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center mb-4 shadow-lg">
            <span className="material-symbols-outlined text-3xl">error</span>
          </div>
          <h3 className="text-2xl font-bold text-on-surface mb-2">No se pudo confirmar</h3>
          <p className="text-on-surface-variant text-lg mb-6">{message}</p>
          <button
            type="button"
            onClick={() => router.push('/cuenta')}
            className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors"
          >
            Volver a mi cuenta
          </button>
        </>
      )}
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div className="w-full lg:w-[40%] min-w-[320px] max-w-[600px] mx-auto bg-surface-container-lowest flex flex-col justify-center p-8 sm:p-12 lg:p-16 z-20 shadow-2xl relative">
        <div className="w-full max-w-md mx-auto flex flex-col items-center">
          <div className="mb-12">
            <img
              src="/isotipo.png"
              alt="Whityouly Isotipo"
              className="h-16 w-auto drop-shadow-md mx-auto"
            />
          </div>

          <Suspense fallback={<div className="text-center text-outline">Cargando...</div>}>
            <ConfirmEmailLogic />
          </Suspense>
        </div>
      </div>

      <div className="hidden lg:flex w-[60%] relative flex-col justify-between overflow-hidden bg-black">
        <img
          alt="Refugio"
          className="absolute inset-0 w-full h-full object-cover opacity-90"
          src="/auth-bg.jpg"
        />
      </div>
    </div>
  );
}
