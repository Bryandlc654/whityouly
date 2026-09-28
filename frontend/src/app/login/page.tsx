'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error('Credenciales inválidas');
      }

      const data = await res.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* LEFT COLUMN: Form (40%) */}
      <div className="w-full lg:w-[40%] min-w-[320px] max-w-[600px] mx-auto bg-surface-container-lowest flex flex-col justify-center p-8 sm:p-12 lg:p-16 z-20 shadow-2xl relative">
        <div className="w-full max-w-md mx-auto">

          {/* Logo only visible on mobile, since desktop has it on the image */}
          <div className="flex lg:hidden items-center justify-center mb-10">
            <img src="/isotipo.png" alt="Whityouly Isotipo" className="h-16 w-auto drop-shadow-md" />
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight mb-2">
              Te damos la bienvenida
            </h2>
            <p className="text-base text-on-surface-variant">
              Ingresa tus credenciales para acceder a tu refugio.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 text-sm font-medium text-on-error-container bg-error-container rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          <form className="flex flex-col gap-6" onSubmit={handleLogin}>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="identifier">
                Correo Electrónico
              </label>
              <div className="relative flex items-center">
                <input
                  className="w-full px-5 py-4 rounded-2xl bg-surface-container-low text-on-surface text-base placeholder:text-outline/70 outline-none transition-all duration-200 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40 border border-transparent focus:border-primary/50 hover:bg-surface-container"
                  id="identifier"
                  name="identifier"
                  placeholder="tu@correo.com"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="password">
                  Contraseña
                </label>
                <a className="text-sm text-primary font-medium hover:underline transition-colors" href="/forgot-password">
                  ¿La olvidaste?
                </a>
              </div>
              <div className="relative flex items-center">
                <input
                  className="w-full pl-5 pr-14 py-4 rounded-2xl bg-surface-container-low text-on-surface text-base placeholder:text-outline/70 outline-none transition-all duration-200 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40 border border-transparent focus:border-primary/50 hover:bg-surface-container"
                  id="password"
                  name="password"
                  placeholder="••••••••••••"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="absolute right-4 text-outline hover:text-on-surface transition-colors p-2 flex items-center justify-center rounded-xl hover:bg-surface-variant"
                  onClick={() => setShowPassword(!showPassword)}
                  title="Mostrar u ocultar contraseña"
                  type="button"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <input defaultChecked className="w-5 h-5 rounded-md text-primary focus:ring-0 cursor-pointer accent-primary border-outline-variant" type="checkbox"/>
                <span className="text-sm font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">Recordar en este equipo</span>
              </label>
            </div>

            <button
              className={`w-full mt-4 py-4 px-6 rounded-2xl text-base font-bold shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.98] ${success ? 'bg-secondary text-on-secondary' : 'bg-primary hover:bg-primary-container hover:text-on-primary-container text-on-primary'}`}
              disabled={loading || success}
              type="submit"
            >
              {loading && !success ? (
                <>
                  <span className="inline-block animate-spin material-symbols-outlined text-xl">progress_activity</span>
                  <span>Autenticando...</span>
                </>
              ) : success ? (
                <>
                  <span className="material-symbols-outlined text-xl">check_circle</span>
                  <span>¡Bienvenido de vuelta!</span>
                </>
              ) : (
                <>
                  <span>Ingresar a mi Refugio</span>
                  <span className="material-symbols-outlined text-xl">login</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-12 text-center text-sm font-medium text-on-surface-variant">
            ¿No tienes una cuenta?
            <a className="font-bold text-primary hover:text-primary-container hover:underline ml-1.5 transition-colors" href="/register">
              Únete a nosotros
            </a>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-outline font-medium">
            <a className="hover:text-primary transition-colors" href="#">Privacidad</a>
            <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
            <a className="hover:text-primary transition-colors" href="#">Ayuda</a>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Full Cover Image (60%) */}
      <div className="hidden lg:flex w-[60%] relative flex-col justify-between overflow-hidden bg-black">
        {/* Full 100% Background Image */}
        <img
          alt="Personas compartiendo un momento cálido de serenidad"
          className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-[20s] ease-out hover:scale-110"
          src="/auth-bg.jpg"
        />

        {/* Elegant Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1c2e]/90 via-[#0d1c2e]/40 to-transparent"></div>
        <div className="absolute inset-0 bg-primary/10 mix-blend-overlay"></div>

        {/* Top Right Logo */}
        <div className="relative z-10 w-full flex justify-end p-10 lg:p-14">
          <img src="/isotipo.png" alt="Whityouly Isotipo" className="h-16 lg:h-20 w-auto drop-shadow-2xl" />
        </div>

        {/* Bottom Left Text over Image */}
        <div className="relative z-10 p-16 max-w-2xl text-white">
          <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 drop-shadow-xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            Tu santuario personal de empatía.
          </h1>
          <p className="text-lg lg:text-xl font-medium text-white/90 leading-relaxed drop-shadow-md max-w-xl">
            Conéctate de forma segura. Sin juicios, sin algoritmos.
            Solo personas compartiendo lo que sienten en absoluta calma.
          </p>
        </div>
      </div>
    </div>
  );
}
