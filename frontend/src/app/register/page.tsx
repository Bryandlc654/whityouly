'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import { tokenStorage } from '@/lib/auth';
import Icon from '@/components/wy/Icon';
import VerifyCodeForm from '@/components/wy/VerifyCodeForm';
import { useI18n } from '@/components/providers/I18nProvider';
import LanguageSwitcher from '@/components/wy/LanguageSwitcher';

// Reglas que exige el backend (auth.dto.ts): 8+ caracteres, mayúscula,
// minúscula y número.
const PASSWORD_RULES = [
  { key: 'auth.register.ruleLength', test: (v: string) => v.length >= 8 },
  { key: 'auth.register.ruleUpper', test: (v: string) => /[A-Z]/.test(v) },
  { key: 'auth.register.ruleLower', test: (v: string) => /[a-z]/.test(v) },
  { key: 'auth.register.ruleNumber', test: (v: string) => /\d/.test(v) },
];

// Genera una contraseña de 14 caracteres con al menos una mayúscula, una
// minúscula, un número y un símbolo, usando el generador seguro del navegador.
function generatePassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*?-_';
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return set[buf[0] % set.length];
  };
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generated, setGenerated] = useState(false);
  // Tras crear la cuenta se pide el código que llega por correo.
  const [step, setStep] = useState<'account' | 'verify'>('account');

  const router = useRouter();
  const { t } = useI18n();

  const handleGenerate = async () => {
    const next = generatePassword();
    setPassword(next);
    setShowPassword(true);
    try {
      await navigator.clipboard.writeText(next);
      setGenerated(true);
    } catch {
      setGenerated(false);
    }
  };

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

            <div className="label-row">
              <label htmlFor="signupPassword">{t('auth.register.password')}</label>
              <button type="button" className="password-generate" onClick={handleGenerate}>
                <Icon name="lock" /> {t('auth.register.generate')}
              </button>
            </div>
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  setGenerated(false);
                }}
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
            <ul className="password-rules" aria-label={t('auth.register.hint')}>
              {PASSWORD_RULES.map((rule) => (
                <li key={rule.key} className={rule.test(password) ? 'ok' : undefined}>
                  <Icon name="check" /> {t(rule.key)}
                </li>
              ))}
            </ul>
            {generated ? (
              <small className="field-hint">{t('auth.register.generatedCopied')}</small>
            ) : null}

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
