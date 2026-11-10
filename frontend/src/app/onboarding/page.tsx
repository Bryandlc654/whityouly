'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, tokenStorage } from '@/lib/auth';
import {
  checkNameAvailability,
  createCharacter,
  listInterests,
} from '@/lib/characters';
import { AVATAR_PRESETS } from '@/lib/avatar';
import Icon from '@/components/wy/Icon';
import { consumeReturnTo } from '@/lib/returnTo';

const NAME_MIN = 3;
const NAME_MAX = 30;
const MAX_INTERESTS = 8;
const NAME_PATTERN = new RegExp('^[\\p{L}\\p{N}][\\p{L}\\p{N} _.-]*$', 'u');
const AVATAR_NAMES = [
  'Aurora',
  'Océano',
  'Hoja',
  'Amanecer',
  'Órbita',
  'Onda',
  'Destello',
  'Luna',
  'Horizonte',
  'Sol',
  'Brisa',
  'Semilla',
];

function normalizeName(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function validateName(value: string) {
  const name = normalizeName(value);
  if (name.length < NAME_MIN) return `El seudónimo debe tener al menos ${NAME_MIN} caracteres.`;
  if (name.length > NAME_MAX) return `El seudónimo no puede superar los ${NAME_MAX} caracteres.`;
  if (!NAME_PATTERN.test(name)) {
    return 'Usa solo letras, números, espacios, guiones, puntos o guion bajo.';
  }
  return null;
}

type NameStatusState = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [nameStatus, setNameStatus] = useState<{ state: NameStatusState; message: string }>({
    state: 'idle',
    message: '',
  });

  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/login');
        return;
      }

      try {
        const response = await authFetch(`${API_URL}/characters/me`);
        if (!active) return;
        if (response.status === 401) {
          tokenStorage.clear();
          router.replace('/login');
          return;
        }
        if (response.ok) {
          router.replace(consumeReturnTo('/feed'));
          return;
        }
        if (response.status === 404) {
          setReady(true);
          return;
        }
        setError('No se pudo comprobar tu cuenta. Inténtalo de nuevo en un momento.');
        setReady(true);
      } catch {
        if (active) {
          setError('No se pudo comprobar tu cuenta. Inténtalo de nuevo en un momento.');
          setReady(true);
        }
      }
    };

    void verify();
    return () => {
      active = false;
    };
  }, [router]);

  const loadCatalog = useCallback(async () => {
    const result = await listInterests();
    if (result.status === 'ok') {
      setCatalog(result.data);
      setCatalogError('');
      return;
    }
    setCatalogError(result.message);
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const invalid = validateName(name);
    if (invalid) {
      setNameStatus({ state: 'idle', message: invalid });
      return;
    }

    let cancelled = false;
    setNameStatus({ state: 'checking', message: 'Comprobando disponibilidad…' });
    const timer = window.setTimeout(() => {
      void checkNameAvailability(name).then((result) => {
        if (cancelled) return;
        if (result.status !== 'ok') {
          setNameStatus({ state: 'error', message: result.message });
          return;
        }
        setNameStatus(
          result.data.available
            ? { state: 'available', message: 'Seudónimo disponible.' }
            : {
                state: 'unavailable',
                message: result.data.reason ?? 'Ese seudónimo ya está en uso.',
              },
        );
      });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name]);

  const interestOptions = useMemo(
    () => Array.from(new Set([...catalog, ...interests])).sort((a, b) => a.localeCompare(b, 'es')),
    [catalog, interests],
  );

  const toggleInterest = (topic: string) => {
    setInterests((prev) => {
      if (prev.includes(topic)) return prev.filter((item) => item !== topic);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, topic];
    });
  };

  const goNext = () => {
    setError('');
    if (step === 0) {
      const invalid = validateName(name);
      if (invalid) {
        setError(invalid);
        return;
      }
      if (nameStatus.state === 'checking') {
        setError('Espera a que terminemos de comprobar el seudónimo.');
        return;
      }
      if (nameStatus.state !== 'available' && nameStatus.state !== 'error') {
        setError(nameStatus.message || 'Elige un seudónimo disponible.');
        return;
      }
    }
    setStep((value) => Math.min(1, value + 1));
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');

    const availability = await checkNameAvailability(name);
    if (availability.status !== 'ok' || !availability.data.available) {
      setError(
        availability.status === 'ok'
          ? availability.data.reason ?? 'Ese seudónimo ya está en uso.'
          : availability.message,
      );
      setBusy(false);
      setStep(0);
      return;
    }

    const created = await createCharacter({
      name: normalizeName(name),
      interests,
      avatarUrl: avatarUrl ?? undefined,
      privacySettings: {
        profileVisibility: 'PUBLIC',
        showAvatar: true,
        showBio: true,
        showFollowing: false,
      },
    });

    if (created.status !== 'ok') {
      setError(created.message);
      setBusy(false);
      return;
    }

    router.replace(consumeReturnTo('/feed'));
    router.refresh();
  };


  return (
    <div className="wy">
      <section className="onboarding-stage">
        <button
          className="auth-brand onboarding-brand"
          type="button"
          onClick={() => router.push('/login')}
          aria-label="Volver a la portada"
        >
          <span className="brand-crop" />
        </button>
        <div className="onboarding-card card">
          <div className="step-line" aria-label={`Paso ${step + 2} de 3`}>
            {[0, 1, 2].map((index) => (
              <Fragment key={index}>
                {index > 0 ? (
                  <i className={index <= step + 1 ? 'done' : undefined} />
                ) : null}
                <span
                  className={
                    index < step + 1 ? 'done' : index === step + 1 ? 'active' : undefined
                  }
                >
                  {index < step + 1 ? <Icon name="check" /> : index + 1}
                </span>
              </Fragment>
            ))}
          </div>

          {!ready ? <p className="muted small">Comprobando tu cuenta…</p> : null}
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          {ready && step === 0 ? (
            <>
              <span className="auth-kicker">PASO 2 DE 3 · IDENTIDAD PÚBLICA</span>
              <h1>¿Cómo quieres que te conozca la comunidad?</h1>
              <p>Elige un seudónimo distinto a tu nombre real. Será único dentro de Withyouly.</p>

              <label htmlFor="aliasName">Tu seudónimo único</label>
              <div className="alias-field">
                <span>@</span>
                <input
                  id="aliasName"
                  value={name}
                  maxLength={NAME_MAX}
                  placeholder="NubeVioleta"
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <p className={`availability ${nameStatus.state}`} role="status" aria-live="polite">
                {nameStatus.message}
              </p>

              <label>Elige un avatar ilustrado</label>
              <p className="avatar-help">
                Avatares ilustrados sin fotografías personales. Podrás cambiarlo después desde tu
                perfil.
              </p>
              <div
                className="avatar-picker avatar-gallery"
                role="group"
                aria-label="Avatares de personas"
              >
                {AVATAR_PRESETS.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    className={`alias-avatar${avatarUrl === url ? ' selected' : ''}`}
                    aria-pressed={avatarUrl === url}
                    onClick={() => setAvatarUrl((current) => (current === url ? null : url))}
                  >
                    <span className="avatar avatar-illustrated">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" width={96} height={96} />
                    </span>
                    <small>{AVATAR_NAMES[index] ?? `Avatar ${index + 1}`}</small>
                  </button>
                ))}
              </div>

              <div className="privacy-explainer">
                <Icon name="shield" />
                <div>
                  <b>La comunidad verá esto</b>
                  <span>
                    Tu seudónimo, miniatura, biografía y relatos públicos. Nunca tu correo ni tu
                    nombre real.
                  </span>
                </div>
              </div>

              <button className="primary auth-submit" type="button" onClick={goNext}>
                Continuar
              </button>
            </>
          ) : null}

          {ready && step === 1 ? (
            <>
              <span className="auth-kicker">PASO 3 DE 3 · TU EXPERIENCIA</span>
              <h1>Haz que Withyouly se sienta tuyo</h1>
              <p>Elige algunos temas para comenzar. Después podrás cambiarlos desde tu perfil.</p>
              <label>¿Qué relatos quieres encontrar primero?</label>
              {catalogError ? (
                <p className="hint">
                  {catalogError}{' '}
                  <button className="text-link" type="button" onClick={() => void loadCatalog()}>
                    Reintentar
                  </button>
                </p>
              ) : null}
              <div className="topic-picker" role="group" aria-label="Temas de interés">
                {interestOptions.length === 0 ? (
                  <p className="hint">Cargando temas…</p>
                ) : (
                  interestOptions.map((topic) => {
                    const selected = interests.includes(topic);
                    const blocked = !selected && interests.length >= MAX_INTERESTS;
                    return (
                      <button
                        key={topic}
                        type="button"
                        className={`topic-choice ${selected ? 'selected' : ''}`.trim()}
                        aria-pressed={selected}
                        disabled={blocked}
                        onClick={() => toggleInterest(topic)}
                      >
                        {topic}
                      </button>
                    );
                  })
                )}
              </div>
              <span className="char-count">
                {interests.length}/{MAX_INTERESTS} elegidos
              </span>

              <div className="onboarding-settings">
                <label>
                  <span>
                    <b>Notificaciones de acompañamiento</b>
                    <small>
                      Avísame cuando alguien marque «Estoy contigo» o actualice un relato que sigo.
                    </small>
                  </span>
                  <input type="checkbox" defaultChecked />
                </label>
                <label>
                  <span>
                    <b>Resumen emocional semanal</b>
                    <small>Un recordatorio privado para revisar cómo me he sentido.</small>
                  </span>
                  <input type="checkbox" defaultChecked />
                </label>
              </div>

              <div className="community-promise">
                <span>
                  <Icon name="heart" />
                </span>
                <p>
                  <b>Una última promesa</b> Comenta para acompañar, no para juzgar ni diagnosticar.
                  Si algo te preocupa, repórtalo.
                </p>
              </div>

              <button
                className="primary auth-submit"
                type="button"
                onClick={() => void submit()}
                disabled={busy}
              >
                {busy ? 'Creando tu personaje…' : 'Entrar a mi comunidad'}
              </button>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
