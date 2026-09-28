'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('http://localhost:3000/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al solicitar el restablecimiento');
      }

      setSuccess(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex selection:bg-primary-fixed selection:text-on-primary-fixed">
      <div className="w-full lg:w-[40%] min-w-[320px] max-w-[600px] mx-auto bg-surface-container-lowest flex flex-col justify-center p-8 sm:p-12 lg:p-16 z-20 shadow-2xl relative">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">
              Recuperar Contraseña
            </h2>
            <p className="text-base text-on-surface-variant">
              Ingresa tu correo para recibir un enlace de recuperación.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 text-sm font-medium text-on-error-container bg-error-container rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 text-sm font-medium text-secondary-fixed-variant bg-secondary-container rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">mark_email_read</span>
              {success}
            </div>
          )}

          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="email">
                Correo Electrónico
              </label>
              <div className="relative flex items-center">
                <input
                  className="w-full px-5 py-4 rounded-2xl bg-surface-container-low text-on-surface text-base placeholder:text-outline/70 outline-none transition-all duration-200 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40 border border-transparent focus:border-primary/50 hover:bg-surface-container"
                  id="email"
                  name="email"
                  placeholder="tu@correo.com"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button
              className="w-full mt-4 py-4 px-6 rounded-2xl text-base font-bold shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-3 bg-primary hover:bg-primary-container hover:text-on-primary-container text-on-primary disabled:opacity-50"
              disabled={loading}
              type="submit"
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin material-symbols-outlined text-xl">progress_activity</span>
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <span>Enviar Enlace Seguros</span>
                  <span className="material-symbols-outlined text-xl">send</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm font-medium text-on-surface-variant">
            <a className="font-bold text-primary hover:text-primary-container hover:underline transition-colors" href="/login">
              Volver al inicio de sesión
            </a>
          </div>
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
