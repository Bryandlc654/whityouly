'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import AuthCard from '@/components/wy/AuthCard';

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
    <>
      {error ? <div className="auth-error">{error}</div> : null}
      {success ? <div className="auth-success">{success}</div> : null}

      <form onSubmit={handleSubmit}>
        <label htmlFor="password">Nueva contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}"
          title="Debe incluir al menos una mayúscula, una minúscula y un número"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <button className="primary" type="submit" disabled={loading || !!success}>
          {loading ? 'Guardando…' : success ? 'Guardado' : 'Actualizar contraseña'}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Crear nueva contraseña"
      subtitle="Ingresa tu nueva contraseña para volver a entrar a tu refugio."
    >
      <Suspense fallback={<p className="auth-note">Cargando…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
