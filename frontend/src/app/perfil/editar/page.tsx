'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, tokenStorage } from '@/lib/auth';
import {
  parseOwnerCharacter,
  removeCharacterAvatar,
  updateCharacter,
  uploadCharacterAvatar,
  type OwnerCharacter,
} from '@/lib/characters';
import ProfileShell from '@/components/wy/ProfileShell';
import ProfileEditor, {
  type ProfileEditorValues,
} from '@/components/profile/ProfileEditor';

export default function EditProfilePage() {
  const router = useRouter();

  const [owner, setOwner] = useState<OwnerCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    const load = async () => {
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

        if (response.status === 404) {
          router.replace('/onboarding');
          return;
        }

        if (!response.ok) {
          setError('No se pudo cargar tu perfil. Inténtalo de nuevo.');
          setLoading(false);
          return;
        }

        const parsed = parseOwnerCharacter(await response.json());

        if (!parsed) {
          setError('La respuesta del servidor no se pudo leer.');
          setLoading(false);
          return;
        }

        setOwner(parsed);
      } catch {
        if (active) {
          setError('No se pudo cargar tu perfil. Inténtalo de nuevo.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [router, reloadKey]);

  const submit = async (values: ProfileEditorValues) => {
    if (busy) return;

    setBusy(true);
    setError('');
    setNotice('');

    // El seudónimo no se envía: se mantiene estable para no romper enlaces ni
    // menciones. El servidor tampoco acepta campos de cuenta desde el cliente.
    const updated = await updateCharacter({
      tagline: values.tagline || null,
      bio: values.bio || null,
      interests: values.interests,
      privacySettings: values.privacySettings,
    });

    if (updated.status !== 'ok') {
      setError(updated.message);
      setBusy(false);
      return;
    }

    let nextOwner = updated.data;
    let avatarError = '';

    if (values.removeAvatar) {
      const removed = await removeCharacterAvatar();

      if (removed.status === 'ok') {
        nextOwner = { ...nextOwner, avatarUrl: null };
      } else {
        avatarError = removed.message;
      }
    } else if (values.avatarFile) {
      const uploaded = await uploadCharacterAvatar(values.avatarFile);

      if (uploaded.status === 'ok') {
        nextOwner = { ...nextOwner, avatarUrl: uploaded.data.avatarUrl };
      } else {
        avatarError = uploaded.message;
      }
    }

    setOwner(nextOwner);
    setEditorKey((value) => value + 1);
    setBusy(false);

    if (avatarError) {
      setError(`Tus datos se guardaron, pero el avatar no: ${avatarError}`);
      return;
    }

    setNotice('Perfil actualizado.');
  };

  return (
    <ProfileShell>
      <section className="screen">
        <div className="screen-heading">
          <div>
            <h1>Editar perfil</h1>
            <p>Tu identidad pública. El correo y el nombre real nunca se muestran.</p>
          </div>
          <button className="ghost" type="button" onClick={() => router.push('/cuenta')}>
            Volver
          </button>
        </div>

        {loading ? <p className="muted small">Cargando tu perfil…</p> : null}

        {!loading && error && !owner ? (
          <div className="auth-error" role="alert">
            {error}
            <button
              className="text-link"
              type="button"
              style={{ marginLeft: 8 }}
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {owner ? (
          <ProfileEditor
            key={editorKey}
            mode="edit"
            initial={owner}
            submitLabel="Guardar cambios"
            busy={busy}
            error={error}
            notice={notice}
            onSubmit={(values) => void submit(values)}
            onCancel={() => router.push('/cuenta')}
          />
        ) : null}
      </section>
    </ProfileShell>
  );
}
