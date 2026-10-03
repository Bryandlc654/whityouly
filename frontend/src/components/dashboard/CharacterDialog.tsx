'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, extractErrorMessage } from '@/lib/api';
import { authFetch } from '@/lib/auth';
import { AVATAR_ACCEPT, validateAvatarFile } from '@/lib/avatar';
import { CharacterSummary, SessionInfo } from './types';

interface CharacterDialogProps {
  character: CharacterSummary | null;
  sessions: SessionInfo[];
  onClose: () => void;
  onCharacterChange: (character: CharacterSummary) => void;
  onLoadSessions: () => Promise<void>;
  onRevokeSession: (session: SessionInfo) => Promise<void>;
  onRevokeOthers: () => Promise<void>;
  onLogout: () => void;
}

type Tab = 'personaje' | 'seguridad';

const MAX_INTERESTS = 8;
const TAGLINE_MAX_LENGTH = 120;

export default function CharacterDialog({
  character,
  sessions,
  onClose,
  onCharacterChange,
  onLoadSessions,
  onRevokeSession,
  onRevokeOthers,
  onLogout,
}: CharacterDialogProps) {
  const [tab, setTab] = useState<Tab>('personaje');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [profileVisibility, setProfileVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [showAvatar, setShowAvatar] = useState(true);
  const [showBio, setShowBio] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState('');
  const [formError, setFormError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const isNew = !character;

  useEffect(() => {
    setName(character?.name ?? '');
    setTagline(character?.tagline ?? '');
    setBio(character?.bio ?? '');
    setInterests(character?.interests ?? []);
    setProfileVisibility(character?.privacySettings?.profileVisibility ?? 'PUBLIC');
    setShowAvatar(character?.privacySettings?.showAvatar ?? true);
    setShowBio(character?.privacySettings?.showBio ?? true);
  }, [character]);

  // El catálogo es público y no cambia seguido: se pide una sola vez al abrir
  // el diálogo y se ignora el fallo para no bloquear la edición del nombre.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/interests`, { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) {
          setCatalog(data.filter((item): item is string => typeof item === 'string'));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  // Los object URLs son fugas de memoria si no se liberan.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (tab === 'seguridad') {
      onLoadSessions();
    }
  }, [tab, onLoadSessions]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const selectAvatarFile = (file: File | null) => {
    setAvatarError('');

    if (!file) {
      setAvatarFile(null);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setAvatarPreview(null);
      return;
    }

    const problem = validateAvatarFile(file);
    if (problem) {
      setAvatarFile(null);
      setAvatarPreview(null);
      setAvatarError(problem);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setAvatarFile(file);
    setAvatarPreview(url);
  };

  /** Sube el archivo como multipart; no se fija Content-Type (lo pone el navegador). */
  const uploadAvatar = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await authFetch(`${API_URL}/characters/me/avatar`, {
        method: 'POST',
        body: formData,
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(extractErrorMessage(payload, 'No se pudo subir el avatar'));
      }
      return payload as CharacterSummary;
    },
    [],
  );

  const changeAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    selectAvatarFile(file);
    if (!file) return;

    setUploadingAvatar(true);
    setAvatarError('');
    try {
      const updated = await uploadAvatar(file);
      onCharacterChange({ ...(character ?? { id: '', name: '' }), ...updated });
      setAvatarFile(null);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setAvatarPreview(null);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'No se pudo subir el avatar');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    setRemovingAvatar(true);
    setAvatarError('');
    try {
      const res = await authFetch(`${API_URL}/characters/me/avatar`, { method: 'DELETE' });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(extractErrorMessage(payload, 'No se pudo quitar el avatar'));
      onCharacterChange({ ...character!, avatarUrl: null });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'No se pudo quitar el avatar');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      const payload = character
        ? {
            ...(name !== character.name ? { name } : {}),
            tagline: tagline || null,
            bio: bio || null,
            interests,
            privacySettings: { profileVisibility, showAvatar, showBio },
          }
        : {
            name,
            tagline: tagline || undefined,
            bio: bio || undefined,
            interests,
            privacySettings: { profileVisibility, showAvatar, showBio },
          };

      const res = await authFetch(
        character ? `${API_URL}/characters/me` : `${API_URL}/characters`,
        {
          method: character ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(extractErrorMessage(data, 'No se pudo guardar tu personaje'));

      setCharacterFromServer(data as CharacterSummary);

      // El avatar se sube después: el endpoint de avatar exige que el
      // personaje exista y solo admite archivos de nuestro almacenamiento.
      if (avatarFile) {
        try {
          const updated = await uploadAvatar(avatarFile);
          onCharacterChange({ ...(data as CharacterSummary), ...updated });
        } catch (error) {
          setAvatarError(
            error instanceof Error
              ? `Personaje guardado, pero el avatar no se pudo subir: ${error.message}`
              : 'Personaje guardado, pero el avatar no se pudo subir.',
          );
        } finally {
          setAvatarFile(null);
          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
          }
          setAvatarPreview(null);
        }
      } else {
        onClose();
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar tu personaje');
    } finally {
      setSaving(false);
    }
  };

  const setCharacterFromServer = (next: CharacterSummary) => {
    onCharacterChange(next);
    setName(next.name);
    setTagline(next.tagline ?? '');
    setBio(next.bio ?? '');
    setInterests(next.interests ?? []);
    setProfileVisibility(next.privacySettings?.profileVisibility ?? 'PUBLIC');
    setShowAvatar(next.privacySettings?.showAvatar ?? true);
    setShowBio(next.privacySettings?.showBio ?? true);
  };

  const toggleInterest = (interest: string) => {
    setInterests((current) => {
      if (current.includes(interest)) {
        return current.filter((item) => item !== interest);
      }
      // El límite también lo impone el servidor: aquí solo evita pulsar de más.
      return current.length < MAX_INTERESTS ? [...current, interest] : current;
    });
  };

  const revoke = async (session: SessionInfo) => {
    setBusySessionId(session.id);
    try {
      await onRevokeSession(session);
    } finally {
      setBusySessionId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-[#0d1c2e]/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes de tu refugio"
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl shadow-2xl"
      >
        <div className="sticky top-0 z-10 bg-surface-container-lowest/95 backdrop-blur px-space-lg pt-space-lg pb-space-sm flex items-start justify-between gap-space-sm border-b border-outline-variant/30">
          <div>
            <h2 className="text-headline-lg text-on-surface">
              {isNew ? 'Crea tu personaje' : 'Tu refugio'}
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              {isNew
                ? 'Este es el seudónimo que verá la comunidad. Tu correo nunca se muestra.'
                : 'Ajusta tu seudónimo, tu avatar y qué partes de tu perfil son públicas.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="px-space-lg py-space-md flex flex-col gap-space-md">
          <div className="flex gap-1 bg-surface-container-low rounded-full p-1 self-start">
            {(
              [
                ['personaje', 'Mi personaje', 'person'],
                ['seguridad', 'Seguridad', 'shield_person'],
              ] as const
            ).map(([value, label, icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-pressed={tab === value}
                className={
                  tab === value
                    ? 'flex items-center gap-1.5 px-space-md py-1.5 rounded-full bg-primary-container text-on-primary-container text-label-md font-semibold transition-colors'
                    : 'flex items-center gap-1.5 px-space-md py-1.5 rounded-full text-on-surface-variant hover:text-on-surface text-label-md transition-colors'
                }
              >
                <span className="material-symbols-outlined text-base">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {tab === 'personaje' ? (
            <form onSubmit={submit} className="flex flex-col gap-space-md">
              {formError && (
                <div className="p-3 text-body-sm font-medium text-on-error-container bg-error-container rounded-xl flex items-start gap-2">
                  <span className="material-symbols-outlined text-lg">error</span>
                  {formError}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label
                  className="text-label-md font-bold uppercase tracking-widest text-on-surface-variant"
                  htmlFor="dialog-pseudonym"
                >
                  Seudónimo público
                </label>
                <input
                  id="dialog-pseudonym"
                  name="pseudonym"
                  required
                  minLength={3}
                  maxLength={30}
                  autoComplete="off"
                  placeholder="ElViajeroSolitario"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-space-md py-3 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant focus:ring-2 focus:ring-primary/40 outline-none"
                />
                <p className="text-label-sm text-on-surface-variant">
                  Entre 3 y 30 caracteres. No podrá cambiarse a menudo para no romper el vínculo con
                  tus relatos.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-label-md font-bold uppercase tracking-widest text-on-surface-variant">
                  Avatar
                </span>
                <div className="flex flex-wrap items-center gap-space-md">
                  <div className="w-16 h-16 shrink-0 rounded-full overflow-hidden bg-surface-container text-on-surface-variant flex items-center justify-center border border-outline-variant">
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarPreview}
                        alt="Vista previa del avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : character?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={character.avatarUrl}
                        alt={`Avatar de ${character.name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined">image</span>
                    )}
                  </div>

                  <div className="flex flex-1 min-w-[180px] flex-col gap-2">
                    <input
                      ref={avatarInputRef}
                      id="dialog-avatar"
                      name="avatar"
                      type="file"
                      accept={AVATAR_ACCEPT}
                      onChange={character ? changeAvatar : (e) => selectAvatarFile(e.target.files?.[0] ?? null)}
                      disabled={uploadingAvatar || removingAvatar}
                      className="text-body-sm text-on-surface-variant file:mr-3 file:rounded-full file:border-0 file:bg-surface-container file:px-4 file:py-2 file:text-on-surface file:font-medium hover:file:bg-tertiary-container disabled:opacity-50 w-full"
                    />
                    {character?.avatarUrl && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        disabled={uploadingAvatar || removingAvatar}
                        className="self-start px-4 py-1.5 text-label-md font-medium text-error hover:bg-error-container rounded-full transition-colors disabled:opacity-50"
                      >
                        {removingAvatar ? 'Quitando...' : 'Quitar avatar'}
                      </button>
                    )}
                    {uploadingAvatar && (
                      <span className="text-body-sm text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined animate-spin text-base">
                          progress_activity
                        </span>
                        Subiendo...
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-label-sm text-on-surface-variant">
                  JPEG, PNG o WebP de hasta 2 MB. La convertimos a WebP y eliminamos sus metadatos.
                </p>
                {avatarError && (
                  <p className="text-body-sm font-medium text-error flex items-start gap-1">
                    <span className="material-symbols-outlined text-base">error</span>
                    {avatarError}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label
                  className="text-label-md font-bold uppercase tracking-widest text-on-surface-variant"
                  htmlFor="dialog-tagline"
                >
                  Descripción
                </label>
                <input
                  id="dialog-tagline"
                  name="tagline"
                  type="text"
                  maxLength={TAGLINE_MAX_LENGTH}
                  placeholder="Una frase sobre ti, en una sola línea"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full px-space-md py-3 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant focus:ring-2 focus:ring-primary/40 outline-none"
                />
                <p className="text-body-sm text-on-surface-variant">
                  {tagline.length}/{TAGLINE_MAX_LENGTH}. Se muestra bajo tu seudónimo.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  className="text-label-md font-bold uppercase tracking-widest text-on-surface-variant"
                  htmlFor="dialog-bio"
                >
                  Biografía
                </label>
                <textarea
                  id="dialog-bio"
                  name="bio"
                  rows={3}
                  maxLength={500}
                  placeholder="Cuéntale a la comunidad quién eres..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-space-md py-3 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant focus:ring-2 focus:ring-primary/40 outline-none resize-none"
                />
              </div>

              <fieldset className="flex flex-col gap-3 rounded-xl border border-outline-variant p-space-md">
                <legend className="px-2 text-label-md font-bold uppercase tracking-widest text-on-surface-variant">
                  Intereses
                </legend>
                <p className="text-body-sm text-on-surface-variant">
                  Elige hasta {MAX_INTERESTS}. Aparecerán en tu perfil público.
                </p>
                {catalog.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant">
                    No se pudo cargar el catálogo de intereses.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {catalog.map((interest) => {
                      const selected = interests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          aria-pressed={selected}
                          className={`rounded-full px-3.5 py-1.5 text-body-sm font-semibold transition-colors border ${
                            selected
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/50'
                          }`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>

              <fieldset className="flex flex-col gap-3 rounded-xl border border-outline-variant p-space-md">
                <legend className="px-2 text-label-md font-bold uppercase tracking-widest text-on-surface-variant">
                  Privacidad
                </legend>

                <div className="flex flex-col gap-2">
                  <label className="text-body-md font-medium text-on-surface" htmlFor="dialog-visibility">
                    Visibilidad del perfil
                  </label>
                  <select
                    id="dialog-visibility"
                    name="visibility"
                    value={profileVisibility}
                    onChange={(e) => setProfileVisibility(e.target.value as 'PUBLIC' | 'PRIVATE')}
                    className="w-full px-space-md py-3 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant focus:ring-2 focus:ring-primary/40 outline-none"
                  >
                    <option value="PUBLIC">Público: cualquiera puede ver mi perfil</option>
                    <option value="PRIVATE">Privado: solo yo puedo verlo</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-body-md text-on-surface">
                  <input
                    type="checkbox"
                    name="showAvatar"
                    checked={showAvatar}
                    disabled={profileVisibility === 'PRIVATE'}
                    onChange={(e) => setShowAvatar(e.target.checked)}
                    className="accent-primary"
                  />
                  Mostrar mi avatar
                </label>

                <label className="flex items-center gap-2 text-body-md text-on-surface">
                  <input
                    type="checkbox"
                    name="showBio"
                    checked={showBio}
                    disabled={profileVisibility === 'PRIVATE'}
                    onChange={(e) => setShowBio(e.target.checked)}
                    className="accent-primary"
                  />
                  Mostrar mi biografía
                </label>
                <p className="text-body-sm text-on-surface-variant">
                  Al ocultar la biografía también se ocultan tu descripción y tus intereses.
                </p>
              </fieldset>

              <button
                type="submit"
                disabled={saving}
                className="px-space-lg py-3 bg-primary text-on-primary rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    Guardando...
                  </>
                ) : isNew ? (
                  'Crear mi personaje'
                ) : (
                  'Guardar cambios'
                )}
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-space-md">
              <div className="flex flex-wrap items-center justify-between gap-space-sm">
                <div>
                  <h3 className="text-headline-sm text-on-surface">Sesiones activas</h3>
                  <p className="text-body-sm text-on-surface-variant">
                    Dispositivos con acceso a tu cuenta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRevokeOthers}
                  className="px-space-md py-2 text-label-md font-medium rounded-full border border-outline-variant hover:bg-surface-container transition-colors"
                >
                  Cerrar otras sesiones
                </button>
              </div>

              <ul className="flex flex-col gap-space-sm">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-low/60 p-space-md rounded-2xl border border-outline-variant/40"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-on-surface truncate">
                        {session.deviceInfo ?? 'Dispositivo desconocido'}
                        {session.current && (
                          <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            Actual
                          </span>
                        )}
                      </p>
                      <p className="text-label-sm text-on-surface-variant truncate">
                        IP {session.ipAddress ?? '—'} · {new Date(session.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revoke(session)}
                      disabled={busySessionId === session.id}
                      className="shrink-0 px-space-md py-2 text-label-md font-medium text-error hover:bg-error-container rounded-full transition-colors disabled:opacity-50"
                    >
                      {session.current ? 'Cerrar sesión' : 'Cerrar'}
                    </button>
                  </li>
                ))}

                {sessions.length === 0 && (
                  <li className="text-body-sm text-on-surface-variant">No hay sesiones activas.</li>
                )}
              </ul>

              <div className="bg-surface-container-low/60 rounded-2xl p-space-md flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-xs text-secondary text-label-lg">
                  <span className="material-symbols-outlined text-base">verified_user</span>
                  <span>Acceso protegido</span>
                </div>
                <p className="text-body-sm text-on-surface-variant">
                  El token de refresco viaja en una cookie httpOnly y se renueva en cada uso. Si
                  reutilizas una cookie antigua, la sesión se revoca por completo.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onLogout}
                    className="text-label-md font-semibold text-error hover:bg-error-container px-space-md py-2 rounded-full transition-colors"
                  >
                    Cerrar la sesión actual
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
