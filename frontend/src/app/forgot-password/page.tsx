'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import Icon from '@/components/wy/Icon';

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
    <div className="wy">
      <section className="onboarding-stage">
        <button
          className="auth-brand onboarding-brand"
          type="button"
          onClick={() => router.push('/')}
          aria-label="Volver a la portada"
        >
          <span className="brand-crop" />
        </button>

        <form className="recovery-card card" onSubmit={handleSubmit}>
          <span className="recovery-icon">
            <Icon name="mail" />
          </span>
          <h1>Recupera tu acceso</h1>
          <p>
            Escribe el correo con el que te registraste. Te enviaremos un enlace seguro para crear
            una nueva contraseña.
          </p>

          {error ? <div className="auth-error">{error}</div> : null}
          {success ? <div className="auth-success">{success}</div> : null}

          <label htmlFor="forgotEmail">Correo electrónico</label>
          <div className="input-with-icon">
            <Icon name="mail" />
            <input
              id="forgotEmail"
              name="email"
              type="email"
              placeholder="tu@correo.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button className="primary auth-submit" type="submit" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar enlace de recuperación'}
          </button>

          <button className="ghost back-login" type="button" onClick={() => router.push('/login')}>
            Volver a iniciar sesión
          </button>
        </form>
      </section>
    </div>
  );
}
