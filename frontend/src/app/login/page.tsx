'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import { authFetch, tokenStorage } from '@/lib/auth';
import AuthCard from '@/components/wy/AuthCard';
import Icon from '@/components/wy/Icon';
import { consumeReturnTo } from '@/lib/returnTo';
import { useI18n } from '@/components/providers/I18nProvider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('motivo') === 'sesion') {
      setSessionExpired(true);
    }
  }, []);

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
        throw new Error(extractErrorMessage(errorData, t('auth.login.invalid')));
      }

      const data = await res.json();
      tokenStorage.setAccess(data.accessToken);
      window.dispatchEvent(new Event('withyouly:session-changed'));

      setSuccess(true);

      let destination = '/feed';
      try {
        const character = await authFetch(`${API_URL}/characters/me`);
        if (character.status === 404) destination = '/onboarding';
        else destination = consumeReturnTo('/feed');
      } catch {
        /* el feed decide cuando termine de cargar */
      }

      setTimeout(() => {
        router.push(destination);
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login.invalid'));
      setLoading(false);
    }
  };

  return (
    <AuthCard
      variant="reference"
      showTrust
      image="/withyouly-community.jpeg"
      imageAlt={t('auth.login.imageAlt')}
    >
      <form className="reference-form" onSubmit={handleLogin}>
        <h1>{t('auth.login.title')}</h1>
        <p>{t('auth.login.subtitle')}</p>
        {sessionExpired ? (
          <div className="tip" role="status">
            <Icon name="lock" /> {t('auth.sessionExpired')}
          </div>
        ) : null}
        {error ? <div className="auth-error">{error}</div> : null}
        {success ? <div className="auth-success">{t('auth.login.submitting')}</div> : null}

        <label htmlFor="identifier">{t('auth.email')}</label>
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
          <label htmlFor="password">{t('auth.password')}</label>
          <button type="button" onClick={() => router.push('/forgot-password')}>
            {t('auth.forgot')}
          </button>
        </div>
        <div className="input-with-icon">
          <Icon name="lock" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder={t('auth.login.passwordPlaceholder')}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="password-eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={showPassword}
          >
            <Icon name={showPassword ? 'lock' : 'eye'} />
          </button>
        </div>

        <button className="primary reference-submit" type="submit" disabled={loading || success}>
          {loading && !success
            ? t('auth.login.submitting')
            : success
              ? t('auth.login.success')
              : t('auth.login.submit')}
        </button>

        <div className="create-account-line">
          <span>{t('auth.login.noAccount')}</span>
          <button type="button" onClick={() => router.push('/register')}>
            {t('auth.login.create')}
          </button>
        </div>
        <div className="reference-legal">
          <button type="button" onClick={() => router.push('/ayuda/privacidad')}>
            {t('auth.privacy')}
          </button>
          <span>·</span>
          <button type="button" onClick={() => router.push('/ayuda')}>
            {t('auth.help')}
          </button>
        </div>
      </form>
    </AuthCard>
  );
}
