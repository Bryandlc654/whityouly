'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import { authFetch, tokenStorage } from '@/lib/auth';
import AuthCard from '@/components/wy/AuthCard';
import Icon from '@/components/wy/Icon';
import VerifyCodeForm from '@/components/wy/VerifyCodeForm';
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
  // Cuenta sin verificar: se pide el código en lugar de solo mostrar el error.
  const [verifyMode, setVerifyMode] = useState(false);
  // Segundo factor: el login devuelve un desafío en vez de una sesión.
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('motivo') === 'sesion') {
      setSessionExpired(true);
    }
  }, []);

  const startVerification = () => {
    setVerifyMode(true);
    setError('');
    // El código anterior pudo vencer: se envía uno nuevo al entrar al paso.
    void fetch(`${API_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => undefined);
  };

  const finishLogin = async (accessToken: string) => {
    setMfaChallenge(null);
    setVerifyMode(false);
    tokenStorage.setAccess(accessToken);
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
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
        const message = extractErrorMessage(errorData, t('auth.login.invalid'));
        if (res.status === 401 && /verifica tu correo/i.test(message)) {
          setLoading(false);
          startVerification();
          return;
        }
        throw new Error(message);
      }

      const data = await res.json();
      if (data.mfaRequired) {
        setMfaChallenge(data.challengeToken);
        setMfaCode('');
        setLoading(false);
        return;
      }

      await finishLogin(data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login.invalid'));
      setVerifyMode(false);
      setLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/auth/mfa/verify-login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: mfaChallenge, code: mfaCode }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(extractErrorMessage(errorData, t('auth.mfa.expired')));
      }

      const data = await res.json();
      await finishLogin(data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login.invalid'));
      setLoading(false);
    }
  };

  return (
    <AuthCard
      variant="reference"
      image="/assets/withyouly-login.webp"
      imageAlt={t('auth.login.imageAlt')}
      imageCaption={
        <>
          <h2>
            {t('auth.login.visualTitle')} <em>{t('auth.login.visualAccent')}</em>
          </h2>
          <p>{t('auth.login.visualText')}</p>
        </>
      }
    >
      {mfaChallenge ? (
        <form className="reference-form" onSubmit={handleMfa}>
          <h1>{t('auth.mfa.title')}</h1>
          <p>{t('auth.mfa.subtitle')}</p>
          {error ? <div className="auth-error">{error}</div> : null}

          <label htmlFor="mfa-code">{t('auth.mfa.code')}</label>
          <div className="input-with-icon">
            <Icon name="lock" />
            <input
              id="mfa-code"
              name="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              required
              autoFocus
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
            />
          </div>

          <p className="hint" style={{ marginTop: 0 }}>
            {t('auth.mfa.recoveryHint')}
          </p>

          <button
            className="primary reference-submit"
            type="submit"
            disabled={loading || mfaCode.replace(/\s+/g, '').length < 6}
          >
            {loading ? t('auth.login.submitting') : t('auth.mfa.submit')}
          </button>
        </form>
      ) : verifyMode ? (
        <div className="reference-form">
          <h1>{t('auth.verify.title')}</h1>
          <VerifyCodeForm
            email={email}
            onVerified={() => handleLogin()}
            onChangeEmail={() => setVerifyMode(false)}
          />
        </div>
      ) : (
      <form className="reference-form" onSubmit={handleLogin}>
        <h1>{t('auth.login.title')}</h1>
        <p>{t('auth.login.subtitle')}</p>
        {sessionExpired ? (
          <div className="tip" role="status">
            <Icon name="lock" /> {t('auth.sessionExpired')}
          </div>
        ) : null}
        {error ? <div className="auth-error">{error}</div> : null}

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
          {loading || success ? t('auth.login.submitting') : t('auth.login.submit')}
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
      )}
      {success ? (
        <div className="login-toast" role="status" aria-live="polite">
          <span className="login-toast-icon">
            <Icon name="check" />
          </span>
          <span>
            <b>{t('auth.login.success')}</b>
            <small>{t('auth.login.successCopy')}</small>
          </span>
        </div>
      ) : null}
    </AuthCard>
  );
}
