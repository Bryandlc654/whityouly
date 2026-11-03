'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout, tokenStorage } from '@/lib/auth';
import {
  checkNameAvailability,
  createCharacter,
  listInterests,
} from '@/lib/characters';
import { AVATAR_PRESETS } from '@/lib/avatar';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';

const NAME_MIN = 3;
const NAME_MAX = 30;
const TAGLINE_MAX = 120;
const BIO_MAX = 500;
const MAX_INTERESTS = 8;
const NAME_PATTERN = new RegExp('^[\\p{L}\\p{N}][\\p{L}\\p{N} _.-]*$', 'u');

function normalizeName(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function initialsOf(name: string) {
  const normalized = normalizeName(name);
  return normalized ? normalized.slice(0, 2).toUpperCase() : '?';
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
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
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
          router.replace('/feed');
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
    setStep((value) => Math.min(2, value + 1));
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
      tagline: tagline.trim() || null,
      bio: bio.trim() || null,
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

    router.replace('/feed');
    router.refresh();
  };

  const endSession = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="wy">
      <section className="onboarding-screen">
        <div className="onboarding-card card onboarding-card-58">
          <div className="auth-logo" role="img" aria-label="Withyouly" />
          <div className="onboarding-step-line" aria-label={`Paso ${step + 1} de 3`}>
            {[0, 1, 2].map((index) => (
              <span key={index} className={index <= step ? 'on' : undefined}>
                {index + 1}
              </span>
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
              <span className="micro-label">PASO 1 DE 3 · TU IDENTIDAD</span>
              <h1>Elige tu seudónimo</h1>
              <p>Tu nombre real y tu correo nunca se muestran. Elige cómo te conocerá la comunidad.</p>
              <label className="field-label">
                Seudónimo único
                <input
                  className="field"
                  value={name}
                  maxLength={NAME_MAX}
                  placeholder="NubeVioleta"
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <p className={`profile-name-status ${nameStatus.state}`} role="status" aria-live="polite">
                {nameStatus.message}
              </p>
              <label className="field-label">
                Descripción corta <span>(opcional)</span>
                <input
                  className="field"
                  value={tagline}
                  maxLength={TAGLINE_MAX}
                  placeholder="Aprendiendo a escucharme con calma."
                  onChange={(event) => setTagline(event.target.value)}
                />
              </label>
              <div className="modal-actions">
                <span />
                <button className="primary" type="button" onClick={goNext}>
                  Continuar <Icon name="chevron" />
                </button>
              </div>
            </>
          ) : null}

          {ready && step === 1 ? (
            <>
              <span className="micro-label">PASO 2 DE 3 · TU AVATAR</span>
              <h1>Elige cómo te verán</h1>
              <p>Puedes escoger un avatar ilustrado. No necesitas subir una fotografía real.</p>
              <div className="onboarding-avatar-preview">
                <Avatar initials={initialsOf(name)} avatarUrl={avatarUrl} size="lg" />
                <span>{avatarUrl ? 'Avatar seleccionado' : 'También puedes continuar sin avatar'}</span>
              </div>
              <div className="avatar-presets onboarding-avatar-presets" role="group" aria-label="Avatares de personas">
                {AVATAR_PRESETS.map((url) => (
                  <button
                    key={url}
                    type="button"
                    className={`avatar-preset${avatarUrl === url ? ' active' : ''}`}
                    aria-pressed={avatarUrl === url}
                    onClick={() => setAvatarUrl((current) => (current === url ? null : url))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" width={48} height={48} />
                  </button>
                ))}
              </div>
              <div className="modal-actions">
                <button className="ghost" type="button" onClick={() => setStep(0)}>
                  Volver
                </button>
                <button className="primary" type="button" onClick={goNext}>
                  Continuar <Icon name="chevron" />
                </button>
              </div>
            </>
          ) : null}

          {ready && step === 2 ? (
            <>
              <span className="micro-label">PASO 3 DE 3 · TU EXPERIENCIA</span>
              <h1>¿Qué temas quieres ver?</h1>
              <p>Elige hasta {MAX_INTERESTS} temas para empezar. Después podrás cambiarlos.</p>
              {catalogError ? (
                <p className="hint">
                  {catalogError}{' '}
                  <button className="text-link" type="button" onClick={() => void loadCatalog()}>
                    Reintentar
                  </button>
                </p>
              ) : null}
              <div className="profile-interests" role="group" aria-label="Temas de interés">
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
                        className={`filter-pill ${selected ? 'active' : ''}`.trim()}
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
              <label className="field-label">
                Biografía <span>(opcional)</span>
                <textarea
                  className="field"
                  value={bio}
                  maxLength={BIO_MAX}
                  placeholder="Cuéntanos qué te trae por aquí, si quieres."
                  onChange={(event) => setBio(event.target.value)}
                />
              </label>
              <p className="hint">
                <Icon name="lock" /> Tu correo y nombre real quedan fuera de la comunidad.
              </p>
              <div className="modal-actions">
                <button className="ghost" type="button" onClick={() => setStep(1)} disabled={busy}>
                  Volver
                </button>
                <button className="primary" type="button" onClick={() => void submit()} disabled={busy}>
                  {busy ? 'Creando tu personaje…' : 'Entrar a mi comunidad'}
                </button>
              </div>
            </>
          ) : null}

          <div className="auth-links" style={{ justifyContent: 'center', marginTop: 18 }}>
            <button type="button" onClick={() => void endSession()}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
