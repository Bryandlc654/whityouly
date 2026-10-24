'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import { authFetch, tokenStorage } from '@/lib/auth';
import AuthCard from '@/components/wy/AuthCard';
import Icon from '@/components/wy/Icon';

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
      window.dispatchEvent(new Event('withyouly:session-changed'));

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
      variant="reference"
      showTrust
      title="Bienvenido a Withyouly"
      subtitle="Ingresa para continuar en tu comunidad."
      image="/withyouly-community.jpeg"
      imageAlt="Jóvenes conversando. Aquí, lo que sientes importa."
    >
      {error ? <div className="auth-error">{error}</div> : null}
      {success ? <div className="auth-success">Acceso correcto. Entrando…</div> : null}

      <form onSubmit={handleLogin}>
        <label htmlFor="identifier">Correo electrónico</label>
        <div className="input-with-icon">
          <Icon name="user" />
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
        </div>

        <div className="label-row">
          <label htmlFor="password">Contraseña</label>
          <button type="button" onClick={() => router.push('/forgot-password')}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <div className="input-with-icon">
          <Icon name="lock" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Tu contraseña"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="password-eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={showPassword}
          >
            <Icon name={showPassword ? 'lock' : 'eye'} />
          </button>
        </div>

        <button
          className="primary reference-submit"
          type="submit"
          disabled={loading || success}
        >
          {loading && !success
            ? 'Entrando…'
            : success
              ? 'Bienvenido de vuelta'
              : 'Iniciar sesión'}
        </button>

        <div className="create-account-line">
          <span>¿Aún no tienes una cuenta?</span>
          <button type="button" onClick={() => router.push('/register')}>
            Crear cuenta
          </button>
        </div>
      </form>
    </AuthCard>
  );
}
