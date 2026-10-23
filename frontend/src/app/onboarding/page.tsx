'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout, tokenStorage } from '@/lib/auth';
import {
  checkNameAvailability,
  createCharacter,
  uploadCharacterAvatar,
} from '@/lib/characters';
import ProfileEditor, {
  type ProfileEditorValues,
} from '@/components/profile/ProfileEditor';

export default function OnboardingPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createdName, setCreatedName] = useState<string | null>(null);

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

        // Quien ya tiene personaje no vuelve a pasar por el onboarding.
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

  const submit = async (values: ProfileEditorValues) => {
    if (busy) return;

    setBusy(true);
    setError('');
    setNotice('');

    // El servidor vuelve a validar todo, pero comprobamos aquí para no crear una
    // cuenta con un seudónimo que ya se ocupó mientras se rellenaba el formulario.
    const availability = await checkNameAvailability(values.name);

    if (availability.status !== 'ok') {
      setError(availability.message);
      setBusy(false);
      return;
    }

    if (!availability.data.available) {
      setError(availability.data.reason ?? 'Ese seudónimo ya está en uso.');
      setBusy(false);
      return;
    }

    const created = await createCharacter({
      name: values.name,
      tagline: values.tagline || null,
      bio: values.bio || null,
      interests: values.interests,
      privacySettings: values.privacySettings,
    });

    if (created.status !== 'ok') {
      setError(created.message);
      setBusy(false);
      return;
    }

    // El avatar se sube después de crear el personaje porque el endpoint exige
    // que exista. Si falla, el perfil ya está creado y se puede reintentar.
    if (values.avatarFile) {
      const avatar = await uploadCharacterAvatar(values.avatarFile);

      if (avatar.status !== 'ok') {
        setCreatedName(created.data.name);
        setNotice(
          'Tu personaje se creó correctamente, pero el avatar no se pudo subir. Puedes intentarlo desde Editar perfil.',
        );
        setError(avatar.message);
        setBusy(false);
        return;
      }
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
        <div className="onboarding-card card">
          <div className="auth-logo" role="img" aria-label="Withyouly" />
          <h1>{createdName ? 'Tu personaje ya existe' : 'Elige tu identidad'}</h1>
          <p>
            {createdName
              ? 'Solo falta el avatar. Puedes añadirlo ahora o más tarde desde tu cuenta.'
              : 'Tu correo y tu nombre real quedan fuera de la comunidad. Las demás personas solo verán el seudónimo y el avatar que elijas.'}
          </p>

          {!ready ? <p className="muted small">Comprobando tu cuenta…</p> : null}

          {ready && createdName ? (
            <div className="stack">
              {notice ? (
                <p className="auth-success" role="status">
                  {notice}
                </p>
              ) : null}
              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="editor-actions" style={{ marginTop: 8 }}>
                <span />
                <div>
                  <button
                    className="primary"
                    type="button"
                    onClick={() => router.replace('/feed')}
                  >
                    Ir al feed
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => router.replace('/perfil/editar')}
                  >
                    Editar perfil
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {ready && !createdName ? (
            <ProfileEditor
              mode="create"
              submitLabel="Crear mi personaje"
              busy={busy}
              error={error}
              onSubmit={(values) => void submit(values)}
            />
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
