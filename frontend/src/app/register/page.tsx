'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import { tokenStorage } from '@/lib/auth';
import Icon from '@/components/wy/Icon';
import VerifyCodeForm from '@/components/wy/VerifyCodeForm';
import { useI18n } from '@/components/providers/I18nProvider';
import LanguageSwitcher from '@/components/wy/LanguageSwitcher';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  // Tras crear la cuenta se pide el código que llega por correo.
  const [step, setStep] = useState<'account' | 'verify'>('account');

  const router = useRouter();
  const { t } = useI18n();

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
        throw new Error(extractErrorMessage(errorData, t('auth.error')));
      }

      setSuccess(true);
      setLoading(false);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.error'));
      setLoading(false);
    }
  };

  // Con el correo verificado se inicia sesión con lo que la persona acaba de
  // escribir, y pasa directo a elegir su seudónimo.
  const signInAfterVerify = async () => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      router.push('/login');
      return;
    }
    const data = await res.json();
    tokenStorage.setAccess(data.accessToken);
    window.dispatchEvent(new Event('withyouly:session-changed'));
    router.push('/onboarding');
  };

  return (
    <div className="wy">
      <div className="auth-lang"><LanguageSwitcher compact /></div>
      <section className="auth-layout signup-layout">
        <div className="auth-pane">
          <button
            className="auth-brand"
            type="button"
            onClick={() => router.push('/')}
            aria-label={t('nav.goHome')}
          >
            <span className="brand-crop" />
          </button>

          {step === 'verify' ? (
            <div className="auth-form">
              <div className="step-line" aria-hidden="true">
                <span className="active">1</span>
                <i />
                <span>2</span>
                <i />
                <span>3</span>
              </div>
              <span className="auth-kicker">{t('auth.verify.kicker')}</span>
              <h1>{t('auth.verify.title')}</h1>
              <VerifyCodeForm
                email={email}
                onVerified={signInAfterVerify}
                onChangeEmail={() => {
                  setStep('account');
                  setSuccess(false);
                }}
              />
            </div>
          ) : (
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="step-line" aria-hidden="true">
              <span className="active">1</span>
              <i />
              <span>2</span>
              <i />
              <span>3</span>
            </div>
            <span className="auth-kicker">{t('auth.register.kicker')}</span>
            <h1>{t('auth.register.title')}</h1>
            <p>{t('auth.register.subtitle')}</p>

            {error ? <div className="auth-error">{error}</div> : null}
            {success ? <div className="auth-success">{t('auth.register.submit')}</div> : null}

            <label htmlFor="signupEmail">{t('auth.email')}</label>
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

            <label htmlFor="signupBirth">{t('auth.register.birth')}</label>
            <div className="input-with-icon">
              <Icon name="calendar" />
              <input id="signupBirth" name="birth" type="date" required />
            </div>

            <label htmlFor="signupPassword">{t('auth.register.password')}</label>
            <div className="input-with-icon">
              <Icon name="lock" />
              <input
                id="signupPassword"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.register.hint')}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-eye"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                <Icon name="eye" />
              </button>
            </div>
            <small className="field-hint">{t('auth.register.hint')}</small>

            <label className="consent-row">
              <input type="checkbox" required />
              <span>
                {t('auth.register.consent')}{' '}
                <button type="button" onClick={() => router.push('/ayuda/normas')}>
                  {t('auth.privacy')}
                </button>
                .
              </span>
            </label>

            <button className="primary auth-submit" type="submit" disabled={loading || success}>
              {loading && !success
                ? t('auth.login.submitting')
                : success
                  ? t('auth.login.success')
                  : t('auth.register.submit')}
            </button>

            <div className="auth-links single">
              <button type="button" onClick={() => router.push('/login')}>
                {t('auth.register.haveAccount')}
              </button>
            </div>
          </form>
          )}
        </div>

        <aside className="signup-benefits">
          <div className="benefit-copy">
            <span className="eyebrow">{t('auth.register.benefitKicker')}</span>
            <h2>{t('auth.register.benefitTitle')}</h2>
            <ul>
              <li>
                <Icon name="check" /> {t('auth.register.benefit1')}
              </li>
              <li>
                <Icon name="check" /> {t('auth.register.benefit2')}
              </li>
              <li>
                <Icon name="check" /> {t('auth.register.benefit3')}
              </li>
              <li>
                <Icon name="check" /> {t('auth.register.benefit4')}
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
