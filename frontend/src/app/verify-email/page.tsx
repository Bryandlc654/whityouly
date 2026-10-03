'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';

function VerifyEmailLogic() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando tu correo electrónico...');

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
    <div className="flex flex-col items-center justify-center text-center">
      {status === 'loading' && (
        <>
          <span className="material-symbols-outlined animate-spin text-primary text-5xl mb-4">progress_activity</span>
          <p className="text-on-surface-variant text-lg">{message}</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-16 h-16 rounded-full bg-secondary-container text-secondary flex items-center justify-center mb-4 shadow-lg">
            <span className="material-symbols-outlined text-3xl">check_circle</span>
          </div>
          <h3 className="text-2xl font-bold text-on-surface mb-2">¡Todo listo!</h3>
          <p className="text-on-surface-variant text-lg mb-6">{message}</p>
          <p className="text-sm text-outline animate-pulse">Redirigiendo al login...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center mb-4 shadow-lg">
            <span className="material-symbols-outlined text-3xl">error</span>
          </div>
          <h3 className="text-2xl font-bold text-on-surface mb-2">Algo salió mal</h3>
          <p className="text-on-surface-variant text-lg mb-6">{message}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors"
          >
            Volver al Login
          </button>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div className="w-full lg:w-[40%] min-w-[320px] max-w-[600px] mx-auto bg-surface-container-lowest flex flex-col justify-center p-8 sm:p-12 lg:p-16 z-20 shadow-2xl relative">
        <div className="w-full max-w-md mx-auto flex flex-col items-center">
          <div className="mb-12">
            <img src="/isotipo.png" alt="Whityouly Isotipo" className="h-16 w-auto drop-shadow-md mx-auto" />
          </div>

          <Suspense fallback={<div className="text-center text-outline">Cargando...</div>}>
            <VerifyEmailLogic />
          </Suspense>
        </div>
      </div>

      <div className="hidden lg:flex w-[60%] relative flex-col justify-between overflow-hidden bg-black">
        <img
          alt="Refugio"
          className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-[20s] ease-out hover:scale-110"
          src="/auth-bg.jpg"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1c2e]/90 via-[#0d1c2e]/40 to-transparent"></div>
        <div className="relative z-10 w-full flex justify-end p-10 lg:p-14">
          <img src="/isotipo.png" alt="Whityouly Isotipo" className="h-16 lg:h-20 w-auto drop-shadow-2xl" />
        </div>
      </div>
    </div>
  );
}
