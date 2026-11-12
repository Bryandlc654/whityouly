'use client';

import { useEffect, useRef, useState } from 'react';
import { API_URL, extractErrorMessage } from '@/lib/api';
import Icon from './Icon';
import { useI18n } from '@/components/providers/I18nProvider';

const RESEND_SECONDS = 60;

interface VerifyCodeFormProps {
  email: string;
  /** Se llama cuando el backend confirma el código. */
  onVerified: () => Promise<void> | void;
  /** Muestra "Usar otro correo" y lo ejecuta al pulsarlo. */
  onChangeEmail?: () => void;
  /** Si ya se envió un código justo antes (registro), arranca con la espera de reenvío. */
  startWithCooldown?: boolean;
}

/** Paso de verificación de correo con el código de 6 dígitos que llega por email. */
export default function VerifyCodeForm({
  email,
  onVerified,
  onChangeEmail,
  startWithCooldown = true,
}: VerifyCodeFormProps) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(startWithCooldown ? RESEND_SECONDS : 0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`${API_URL}/auth/verify-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(extractErrorMessage(data, t('auth.error')));
      }
      await onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.error'));
      setCode('');
      inputRef.current?.focus();
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError('');
    setNotice('');
    setCooldown(RESEND_SECONDS);
    try {
      await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setNotice(t('auth.verify.resent'));
    } catch {
      setError(t('auth.error'));
    }
  };

  return (
    <form className="verify-code-form" onSubmit={submit}>
      <p className="verify-code-copy">{t('auth.verify.subtitle', { email })}</p>

      {error ? <div className="auth-error">{error}</div> : null}
      {notice ? <div className="auth-success">{notice}</div> : null}

      <label htmlFor="verifyCode">{t('auth.verify.code')}</label>
      <input
        ref={inputRef}
        id="verifyCode"
        name="code"
        className="verify-code-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        placeholder="000000"
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />

      <button className="primary auth-submit" type="submit" disabled={loading || code.length !== 6}>
        {loading ? t('auth.verify.submitting') : t('auth.verify.submit')}
      </button>

      <div className="verify-code-actions">
        <button type="button" onClick={resend} disabled={cooldown > 0}>
          <Icon name="mail" />{' '}
          {cooldown > 0 ? t('auth.verify.resendIn', { seconds: cooldown }) : t('auth.verify.resend')}
        </button>
        {onChangeEmail ? (
          <button type="button" onClick={onChangeEmail}>
            {t('auth.verify.changeEmail')}
          </button>
        ) : null}
      </div>
      <small className="field-hint">{t('auth.verify.spam')}</small>
    </form>
  );
}
