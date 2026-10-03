'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';

function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('No hay ningún token válido en la URL.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, 'Error al restablecer la contraseña'));
      }

      setSuccess(data.message);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="password">
          Nueva Contraseña
        </label>
        <div className="relative flex items-center">
          <input
            className="w-full px-5 py-4 rounded-2xl bg-surface-container-low text-on-surface text-base placeholder:text-outline/70 outline-none transition-all duration-200 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40 border border-transparent focus:border-primary/50 hover:bg-surface-container"
            id="password"
            name="password"
            placeholder="Mínimo 8 caracteres"
            required
            minLength={8}
            maxLength={72}
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}"
            title="Debe incluir al menos una mayúscula, una minúscula y un número"
            autoComplete="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
      </div>

      <button
        className="w-full mt-4 py-4 px-6 rounded-2xl text-base font-bold shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-3 bg-primary hover:bg-primary-container hover:text-on-primary-container text-on-primary disabled:opacity-50"
        disabled={loading || !!success}
        type="submit"
      >
        {loading ? (
          <>
            <span className="inline-block animate-spin material-symbols-outlined text-xl">progress_activity</span>
            <span>Guardando...</span>
          </>
        ) : success ? (
          <>
            <span className="material-symbols-outlined text-xl">check_circle</span>
            <span>¡Guardado!</span>
          </>
        ) : (
          <>
            <span>Actualizar Contraseña</span>
            <span className="material-symbols-outlined text-xl">lock_reset</span>
          </>
        )}
      </button>

      {error && (
        <div className="mt-2 p-4 text-sm font-medium text-on-error-container bg-error-container rounded-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          {error}
        </div>
      )}

      {success && (
        <div className="mt-2 p-4 text-sm font-medium text-secondary-fixed-variant bg-secondary-container rounded-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          {success}
        </div>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div className="w-full lg:w-[40%] min-w-[320px] max-w-[600px] mx-auto bg-surface-container-lowest flex flex-col justify-center p-8 sm:p-12 lg:p-16 z-20 shadow-2xl relative">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">
              Crear Nueva Contraseña
            </h2>
            <p className="text-base text-on-surface-variant">
              Ingresa tu nueva contraseña para acceder a tu refugio.
            </p>
          </div>

          <Suspense fallback={<div>Cargando...</div>}>
            <ResetPasswordForm />
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
