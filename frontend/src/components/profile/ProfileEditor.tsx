'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';
import { AVATAR_ACCEPT, validateAvatarFile } from '@/lib/avatar';
import { checkNameAvailability, listInterests, type OwnerCharacter } from '@/lib/characters';
import type { PrivacySettings } from '@/components/feed/types';

const NAME_MIN = 3;
const NAME_MAX = 30;
const TAGLINE_MAX = 120;
const BIO_MAX = 500;
const MAX_INTERESTS = 8;
// Se construye en tiempo de ejecución para no depender del `target` de TS al
// analizar literales con el flag `u`. El servidor vuelve a validar el patrón.
const NAME_PATTERN = new RegExp('^[\\p{L}\\p{N}][\\p{L}\\p{N} _.-]*$', 'u');

const DEFAULT_PRIVACY: PrivacySettings = {
  profileVisibility: 'PUBLIC',
  showAvatar: true,
  showBio: true,
  showFollowing: false,
};

export interface ProfileEditorValues {
  name: string;
  tagline: string;
  bio: string;
  interests: string[];
  privacySettings: PrivacySettings;
  avatarFile: File | null;
  removeAvatar: boolean;
}

interface Props {
  mode: 'create' | 'edit';
  initial?: OwnerCharacter | null;
  submitLabel: string;
  busy: boolean;
  error?: string;
  notice?: string;
  onSubmit: (values: ProfileEditorValues) => void;
  onCancel?: () => void;
}

type NameStatusState = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

interface NameStatus {
  state: NameStatusState;
  message: string;
}

function normalizeName(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function validateName(value: string): string | null {
  const name = normalizeName(value);

  if (name.length < NAME_MIN) {
    return `El seudónimo debe tener al menos ${NAME_MIN} caracteres.`;
  }
  if (name.length > NAME_MAX) {
    return `El seudónimo no puede superar los ${NAME_MAX} caracteres.`;
  }
  if (!NAME_PATTERN.test(name)) {
    return 'Usa solo letras, números, espacios, guiones, puntos o guion bajo.';
  }
  return null;
}

function initialsOf(name: string) {
  const normalized = normalizeName(name);
  return normalized ? normalized.slice(0, 2).toUpperCase() : '?';
}

export default function ProfileEditor({
  mode,
  initial,
  submitLabel,
  busy,
  error,
  notice,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [tagline, setTagline] = useState(initial?.tagline ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [interests, setInterests] = useState<string[]>(initial?.interests ?? []);
  const [privacy, setPrivacy] = useState<PrivacySettings>(
    initial?.privacySettings ?? DEFAULT_PRIVACY,
  );

  const [catalog, setCatalog] = useState<string[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [nameStatus, setNameStatus] = useState<NameStatus>({
    state: 'idle',
    message: '',
  });
  const [localError, setLocalError] = useState('');

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initial?.avatarUrl ?? null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

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

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    },
    [],
  );

  // Disponibilidad del seudónimo: se consulta con retardo para no golpear la API
  // en cada pulsación. El servidor vuelve a comprobarlo al crear el personaje.
  useEffect(() => {
    if (mode !== 'create') return;

    const invalid = validateName(name);
    if (invalid) {
      setNameStatus({ state: 'idle', message: invalid });
      return;
    }

    let cancelled = false;
    setNameStatus({ state: 'checking', message: 'Comprobando disponibilidad…' });

    const timer = setTimeout(() => {
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
  }, [name, mode]);

  const interestOptions = useMemo(() => {
    const unique = new Set<string>([
      ...catalog,
      ...interests,
      ...(initial?.interests ?? []),
    ]);

    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalog, interests, initial]);

  const toggleInterest = (topic: string) => {
    setInterests((prev) => {
      if (prev.includes(topic)) {
        return prev.filter((item) => item !== topic);
      }
      if (prev.length >= MAX_INTERESTS) {
        return prev;
      }
      return [...prev, topic];
    });
  };

  const selectAvatar = (file: File | null) => {
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setAvatarPreview(url);
    setAvatarFile(file);
    setRemoveAvatar(false);
    setLocalError('');
  };

  const clearAvatar = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (avatarFile) {
      // Se descarta la selección nueva y se vuelve al avatar ya guardado.
      setAvatarFile(null);
      setAvatarPreview(initial?.avatarUrl ?? null);
      setRemoveAvatar(false);
      return;
    }

    setAvatarPreview(null);
    setRemoveAvatar(Boolean(initial?.avatarUrl));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError('');

    if (mode === 'create') {
      const nameError = validateName(name);
      if (nameError) {
        setLocalError(nameError);
        return;
      }

      if (nameStatus.state === 'checking') {
        setLocalError('Espera a que terminemos de comprobar el seudónimo.');
        return;
      }

      if (nameStatus.state !== 'available' && nameStatus.state !== 'error') {
        setLocalError(nameStatus.message || 'Elige un seudónimo disponible.');
        return;
      }
    }

    if (bio.length > BIO_MAX) {
      setLocalError(`La biografía no puede superar los ${BIO_MAX} caracteres.`);
      return;
    }

    const cleanTagline = tagline.trim();
    const cleanBio = bio.trim();

    onSubmit({
      name: normalizeName(name),
      tagline: cleanTagline,
      bio: cleanBio,
      interests,
      privacySettings: privacy,
      avatarFile,
      removeAvatar,
    });
  };

  const combinedError = localError || error || '';

  return (
    <form className="editor card profile-editor" onSubmit={submit} noValidate>
      {combinedError ? (
        <p className="auth-error" role="alert" style={{ marginTop: 0 }}>
          {combinedError}
        </p>
      ) : null}

      {notice ? (
        <p className="auth-success" role="status" style={{ marginTop: 0 }}>
          {notice}
        </p>
      ) : null}

      <div className="profile-avatar-editor">
        <Avatar
          initials={initialsOf(name)}
          avatarUrl={avatarPreview}
          size="lg"
          alt="Vista previa de tu avatar"
        />
        <div className="profile-avatar-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept={AVATAR_ACCEPT}
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              selectAvatar(file);
            }}
          />
          <button
            className="secondary"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <Icon name="user" /> Cambiar avatar
          </button>
          {avatarPreview ? (
            <button className="ghost" type="button" onClick={clearAvatar} disabled={busy}>
              Quitar
            </button>
          ) : null}
          <p className="hint" style={{ margin: '6px 0 0' }}>
            JPEG, PNG o WebP · máximo 2 MB.
          </p>
        </div>
      </div>

      <label htmlFor="profile-name">Seudónimo</label>
      <input
        id="profile-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={NAME_MAX}
        disabled={mode === 'edit' || busy}
        autoComplete="off"
        spellCheck={false}
        aria-describedby="profile-name-status"
        className={mode === 'edit' ? 'is-locked' : undefined}
      />
      <p
        id="profile-name-status"
        className={`profile-name-status ${nameStatus.state}`}
        role="status"
        aria-live="polite"
      >
        {mode === 'edit'
          ? 'El seudónimo es estable para que otras personas puedan reconocerte.'
          : nameStatus.message}
      </p>

      <label htmlFor="profile-tagline">Descripción corta</label>
      <input
        id="profile-tagline"
        value={tagline}
        onChange={(event) => setTagline(event.target.value)}
        maxLength={TAGLINE_MAX}
        placeholder="Una frase que te describa"
        disabled={busy}
      />
      <span className="char-count">
        {tagline.length}/{TAGLINE_MAX}
      </span>

      <label htmlFor="profile-bio">Biografía</label>
      <textarea
        id="profile-bio"
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        maxLength={BIO_MAX}
        placeholder="Cuéntanos qué te trae por aquí, si quieres."
        disabled={busy}
      />
      <span className="char-count">
        {bio.length}/{BIO_MAX}
      </span>

      <label>Temas que quieres ver</label>
      {catalogError ? (
        <p className="hint" style={{ margin: '0 0 8px' }}>
          {catalogError}{' '}
          <button className="text-link" type="button" onClick={() => void loadCatalog()}>
            Reintentar
          </button>
        </p>
      ) : null}
      <div className="profile-interests" role="group" aria-label="Temas de interés">
        {interestOptions.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            Cargando temas…
          </p>
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
                disabled={busy || blocked}
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

      <label>Visibilidad del perfil</label>
      <div className="segmented">
        <button
          type="button"
          className={privacy.profileVisibility === 'PUBLIC' ? 'active' : undefined}
          aria-pressed={privacy.profileVisibility === 'PUBLIC'}
          onClick={() => setPrivacy((prev) => ({ ...prev, profileVisibility: 'PUBLIC' }))}
          disabled={busy}
        >
          Público
        </button>
        <button
          type="button"
          className={privacy.profileVisibility === 'PRIVATE' ? 'active' : undefined}
          aria-pressed={privacy.profileVisibility === 'PRIVATE'}
          onClick={() => setPrivacy((prev) => ({ ...prev, profileVisibility: 'PRIVATE' }))}
          disabled={busy}
        >
          Privado
        </button>
      </div>
      <p className="hint" style={{ margin: '6px 0 0' }}>
        Un perfil privado no aparece en búsquedas ni en enlaces públicos.
      </p>

      <label>Qué muestras en tu perfil</label>
      <div className="settings-list">
        <label className="settings-row">
          <span>
            <Icon name="user" />
          </span>
          <span>
            <b>Mostrar mi avatar</b>
            <small>Si lo ocultas, solo se verá tu seudónimo.</small>
          </span>
          <span>
            <input
              type="checkbox"
              checked={privacy.showAvatar}
              onChange={(event) =>
                setPrivacy((prev) => ({ ...prev, showAvatar: event.target.checked }))
              }
              disabled={busy}
            />
          </span>
        </label>

        <label className="settings-row">
          <span>
            <Icon name="book" />
          </span>
          <span>
            <b>Mostrar mi biografía</b>
            <small>Oculta tu descripción, biografía e intereses.</small>
          </span>
          <span>
            <input
              type="checkbox"
              checked={privacy.showBio}
              onChange={(event) =>
                setPrivacy((prev) => ({ ...prev, showBio: event.target.checked }))
              }
              disabled={busy}
            />
          </span>
        </label>

        <label className="settings-row">
          <span>
            <Icon name="users" />
          </span>
          <span>
            <b>Mostrar a quién sigo</b>
            <small>Si lo desactivas, solo tú verás tu lista de seguidos.</small>
          </span>
          <span>
            <input
              type="checkbox"
              checked={privacy.showFollowing}
              onChange={(event) =>
                setPrivacy((prev) => ({ ...prev, showFollowing: event.target.checked }))
              }
              disabled={busy}
            />
          </span>
        </label>
      </div>

      <div className="editor-actions">
        <span className="char-count">
          {mode === 'create' ? 'Podrás cambiarlo después desde tu cuenta.' : ''}
        </span>
        <div>
          {onCancel ? (
            <button className="ghost" type="button" onClick={onCancel} disabled={busy}>
              Cancelar
            </button>
          ) : null}
          <button
            className="primary"
            type="submit"
            disabled={
              busy ||
              (mode === 'create' &&
                nameStatus.state !== 'available' &&
                nameStatus.state !== 'error')
            }
          >
            {busy ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
