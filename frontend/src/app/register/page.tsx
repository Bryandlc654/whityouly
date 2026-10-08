'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import AuthCard from '@/components/wy/AuthCard';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(extractErrorMessage(errorData, 'Error al crear la cuenta'));
      }

      // El registro NO devuelve tokens: la cuenta debe verificarse por correo primero.
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta');
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Crea tu espacio seudónimo"
      subtitle="Tu correo protege el acceso. Las demás personas solo conocerán el seudónimo que elijas."
    >
      {error ? <div className="auth-error">{error}</div> : null}
      {success ? (
        <div className="auth-success">
          Cuenta creada. Revisa tu correo para verificar el acceso.
        </div>
      ) : null}

      <form onSubmit={handleRegister}>
        <label htmlFor="identifier">Correo electrónico (privado)</label>
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

        <label htmlFor="password">Contraseña segura</label>
        <div className="auth-input-wrap">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}"
            title="Debe incluir al menos una mayúscula, una minúscula y un número"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="ghost" onClick={() => setShowPassword((v) => !v)}>
            {showPassword ? 'Ocultar' : 'Ver'}
          </button>
        </div>

        <button className="primary" type="submit" disabled={loading || success}>
          {loading && !success ? 'Creando tu cuenta…' : success ? 'Revisa tu correo' : 'Crear cuenta'}
        </button>
      </form>

      <div className="auth-links" style={{ justifyContent: 'center' }}>
        <button type="button" onClick={() => router.push('/login')}>
          Ya tengo una cuenta
        </button>
      </div>
    </AuthCard>
  );
}
