'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import { authFetch, tokenStorage } from '@/lib/auth';
import AuthCard from '@/components/wy/AuthCard';

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
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(extractErrorMessage(errorData, 'Credenciales inválidas'));
      }

      const data = await res.json();
      // El refresh token viaja en una cookie httpOnly; solo guardamos el access token.
      tokenStorage.setAccess(data.accessToken);

      setSuccess(true);

      // Una cuenta recién verificada aún no tiene personaje: primero elige su
      // seudónimo. Si la comprobación falla, el feed vuelve a intentarlo.
      let destination = '/feed';
      try {
        const character = await authFetch(`${API_URL}/characters/me`);
        if (character.status === 404) destination = '/onboarding';
      } catch {
        /* el feed decide cuando termine de cargar */
      }

      setTimeout(() => {
        router.push(destination);
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciales inválidas');
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Te damos la bienvenida"
      subtitle="Ingresa de forma segura. La comunidad nunca verá tu correo ni tu nombre real."
      image="/auth-bg.png"
      imageAlt="Comunidad de Withyouly"
    >
      {error ? <div className="auth-error">{error}</div> : null}
      {success ? <div className="auth-success">Acceso correcto. Entrando…</div> : null}

      <form onSubmit={handleLogin}>
        <label htmlFor="identifier">Correo electrónico</label>
        <input
          id="identifier"
          name="identifier"
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password">Contraseña</label>
        <div className="auth-input-wrap">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••••••"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="ghost" onClick={() => setShowPassword((v) => !v)}>
            {showPassword ? 'Ocultar' : 'Ver'}
          </button>
        </div>

        <button className="primary" type="submit" disabled={loading || success}>
          {loading && !success ? 'Entrando…' : success ? 'Bienvenido de vuelta' : 'Ingresar a Withyouly'}
        </button>
      </form>

      <div className="auth-links">
        <button type="button" onClick={() => router.push('/forgot-password')}>
          ¿Olvidaste tu contraseña?
        </button>
        <button type="button" onClick={() => router.push('/register')}>
          Crear una cuenta
        </button>
      </div>
    </AuthCard>
  );
}
