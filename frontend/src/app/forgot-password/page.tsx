'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import AuthCard from '@/components/wy/AuthCard';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, 'Error al solicitar el restablecimiento'));
      }

      setSuccess(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al solicitar el restablecimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Recuperar contraseña"
      subtitle="Ingresa tu correo para recibir un enlace seguro de recuperación."
    >
      {error ? <div className="auth-error">{error}</div> : null}
      {success ? <div className="auth-success">{success}</div> : null}

      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar enlace seguro'}
        </button>
      </form>

      <div className="auth-links" style={{ justifyContent: 'center' }}>
        <button type="button" onClick={() => router.push('/login')}>
          Volver al inicio de sesión
        </button>
      </div>
    </AuthCard>
  );
}
