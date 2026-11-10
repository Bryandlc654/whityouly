'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import Icon from '@/components/wy/Icon';

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
    <div className="wy">
      <section className="auth-layout signup-layout">
        <div className="auth-pane">
          <button
            className="auth-brand"
            type="button"
            onClick={() => router.push('/')}
            aria-label="Volver a la portada"
          >
            <span className="brand-crop" />
          </button>

          <form className="auth-form" onSubmit={handleRegister}>
            <div className="step-line" aria-hidden="true">
              <span className="active">1</span>
              <i />
              <span>2</span>
              <i />
              <span>3</span>
            </div>
            <span className="auth-kicker">PASO 1 DE 3 · TU CUENTA</span>
            <h1>Crea un acceso privado</h1>
            <p>
              Estos datos protegen tu cuenta. Tu correo y fecha de nacimiento nunca aparecerán en
              tu perfil público.
            </p>

            {error ? <div className="auth-error">{error}</div> : null}
            {success ? (
              <div className="auth-success">
                Cuenta creada. Revisa tu correo para verificar el acceso; después elegirás tu
                seudónimo.
              </div>
            ) : null}

            <label htmlFor="signupEmail">Correo electrónico</label>
            <div className="input-with-icon">
              <Icon name="mail" />
              <input
                id="signupEmail"
                name="email"
                type="email"
                placeholder="tu@correo.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <label htmlFor="signupBirth">Fecha de nacimiento</label>
            <div className="input-with-icon">
              <Icon name="calendar" />
              <input id="signupBirth" name="birth" type="date" required />
            </div>

            <label htmlFor="signupPassword">Crea una contraseña</label>
            <div className="input-with-icon">
              <Icon name="lock" />
              <input
                id="signupPassword"
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
              <button
                type="button"
                className="password-eye"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Icon name="eye" />
              </button>
            </div>
            <small className="field-hint">Mínimo 8 caracteres.</small>

            <label className="consent-row">
              <input type="checkbox" required />
              <span>
                Confirmo que tengo 18 años o más y acepto las{' '}
                <button type="button" onClick={() => router.push('/ayuda/normas')}>
                  normas y la política de privacidad
                </button>
                .
              </span>
            </label>

            <button className="primary auth-submit" type="submit" disabled={loading || success}>
              {loading && !success
                ? 'Creando tu cuenta…'
                : success
                  ? 'Revisa tu correo'
                  : 'Continuar y elegir seudónimo'}
            </button>

            <div className="auth-links single">
              <button type="button" onClick={() => router.push('/login')}>
                Ya tengo una cuenta
              </button>
            </div>
          </form>
        </div>

        <aside className="signup-benefits">
          <div className="benefit-copy">
            <span className="eyebrow">TU IDENTIDAD, BAJO TU CONTROL</span>
            <h2>Tu nombre real no es tu perfil.</h2>
            <ul>
              <li>
                <Icon name="check" /> Elige un seudónimo único
              </li>
              <li>
                <Icon name="check" /> Usa un avatar ilustrado
              </li>
              <li>
                <Icon name="check" /> Decide qué contar y qué guardar
              </li>
              <li>
                <Icon name="check" /> El Mood Tracker siempre es privado
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
