'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL, extractErrorMessage } from '@/lib/api';
import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';
import AuthCard from '@/components/wy/AuthCard';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { t } = useI18n();

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
        throw new Error(extractErrorMessage(data, t('auth.error')));
      }

      setSuccess(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.error'));
    } finally {
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
      <form className="reference-form" onSubmit={handleSubmit}>
        <h1>{t('auth.forgot.title')}</h1>
        <p>{t('auth.forgot.subtitle')}</p>

        {error ? <div className="auth-error">{error}</div> : null}
        {success ? <div className="auth-success">{success}</div> : null}

        <label htmlFor="forgotEmail">{t('auth.email')}</label>
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

        <button className="primary reference-submit" type="submit" disabled={loading}>
          {loading ? t('auth.login.submitting') : t('auth.forgot.submit')}
        </button>

        <div className="create-account-line">
          <button type="button" onClick={() => router.push('/login')}>
            {t('auth.forgot.back')}
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
