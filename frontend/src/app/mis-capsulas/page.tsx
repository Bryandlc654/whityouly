'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Icon from '@/components/wy/Icon';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import { MOODS, MOOD_EMOJI } from '@/components/wy/MoodModal';
import { createCapsule, deleteCapsule, listCapsules, updateCapsule, type Capsule } from '@/lib/capsules';

const DATE_OPTIONS = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '3 meses' },
  { value: '365', label: '1 año' },
  { value: 'custom', label: 'Elegir fecha' },
];

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function dateOnly(value: Date) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function openDateFromChoice(choice: string, custom: string): Date | null {
  if (choice === 'custom') {
    if (!custom) return null;
    const date = new Date(`${custom}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const days = Number(choice);
  if (!Number.isFinite(days)) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(12, 0, 0, 0);
  return date;
}

function remainingLabel(capsule: Capsule) {
  const open = new Date(capsule.openAt);
  if (Number.isNaN(open.getTime()) || open.getTime() <= Date.now()) {
    return `Abierta el ${dateLabel(capsule.openAt)}`;
  }
  const days = Math.floor((open.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return 'Se abre hoy';
  if (days === 1) return 'Se abre mañana';
  return `Se abre en ${days} días`;
}

export default function CapsulesPage() {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');

  const [content, setContent] = useState('');
  const [mood, setMood] = useState('Esperanza');
  const [dateChoice, setDateChoice] = useState('30');
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const [editing, setEditing] = useState<Capsule | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editMood, setEditMood] = useState('Esperanza');
  const [editDate, setEditDate] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const load = useCallback(async () => {
    setListLoading(true);
    setError('');
    const result = await listCapsules();
    setListLoading(false);
    if (result.status === 'ok') setCapsules(result.data.items);
    else {
      setCapsules([]);
      setError(result.message);
    }
  }, []);

  useEffect(() => {
    const verify = async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/login');
        return;
      }
      try {
        const res = await authFetch(`${API_URL}/characters/me`);
        if (res.status === 401) {
          tokenStorage.clear();
          router.replace('/login');
          return;
        }
        if (res.status === 404) {
          router.replace('/onboarding');
          return;
        }
        if (res.ok) setCharacter(await res.json());
      } catch (err) {
        console.error('Error verificando sesión', err);
      } finally {
        setLoading(false);
      }
    };
    void verify();
  }, [router]);

  useEffect(() => {
    if (!loading) void load();
  }, [loading, load]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Ir al Feed', icon: 'home', onClick: () => router.push('/feed') },
        { label: 'Mis relatos', icon: 'book', onClick: () => router.push('/mis-relatos') },
        { label: 'Mi perfil', icon: 'user', onClick: () => router.push('/cuenta') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
        { label: 'Ayuda y soporte', icon: 'mail', onClick: () => router.push('/soporte') },
        {
          label: 'Privacidad y configuración',
          icon: 'settings',
          onClick: () => router.push('/cuenta/configuracion'),
        },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        router.push('/feed');
        break;
      case 'mood':
        router.push('/mi-estado');
        break;
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'notifications':
        router.push('/notificaciones');
        break;
      case 'help':
        router.push('/soporte');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const save = async () => {
    const text = content.trim();
    if (!text) {
      setFormError('Escribe un mensaje para tu yo futuro.');
      return;
    }

    const openDate = openDateFromChoice(dateChoice, customDate);
    if (!openDate || openDate.getTime() <= Date.now()) {
      setFormError('Elige una fecha futura para abrir tu cápsula.');
      return;
    }

    setSaving(true);
    setFormError('');
    const result = await createCapsule({ content: text, mood, openAt: openDate.toISOString() });
    setSaving(false);

    if (result.status !== 'ok') {
      setFormError(result.message);
      return;
    }

    setContent('');
    setDateChoice('30');
    setCustomDate('');
    notify('Cápsula guardada solo para ti.');
    await load();
  };

  const openManage = (capsule: Capsule) => {
    setEditing(capsule);
    setEditContent(capsule.content);
    setEditMood(capsule.mood ?? 'Esperanza');
    setEditDate(dateOnly(new Date(capsule.openAt)));
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editing) return;
    const text = editContent.trim();
    if (!text) {
      setEditError('Escribe un mensaje para tu yo futuro.');
      return;
    }

    const date = editDate ? new Date(`${editDate}T12:00:00`) : null;
    const originalDate = dateOnly(new Date(editing.openAt));
    const dateChanged = Boolean(editDate && editDate !== originalDate);
    if (dateChanged && date && date.getTime() <= Date.now()) {
      setEditError('Elige una fecha futura para abrir tu cápsula.');
      return;
    }

    setEditSaving(true);
    setEditError('');
    const result = await updateCapsule(editing.id, {
      content: text,
      mood: editMood,
      ...(dateChanged && date ? { openAt: date.toISOString() } : {}),
    });
    setEditSaving(false);

    if (result.status !== 'ok') {
      setEditError(result.message);
      return;
    }

    setEditing(null);
    notify('Cápsula actualizada.');
    await load();
  };

  const confirmDelete = (capsule: Capsule) => {
    setEditing(null);
    setSheet({
      title: '¿Eliminar esta cápsula?',
      rows: [
        { label: 'Conservar cápsula', icon: 'shield', onClick: () => setSheet(null) },
        {
          label: 'Eliminar definitivamente',
          icon: 'trash',
          danger: true,
          onClick: async () => {
            const result = await deleteCapsule(capsule.id);
            if (result.status !== 'ok') {
              notify(result.message);
              return;
            }
            setCapsules((prev) => prev.filter((item) => item.id !== capsule.id));
            notify('Cápsula eliminada.');
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <div className="wy" style={{ display: 'grid', placeItems: 'center' }}>
        <p className="muted">Verificando acceso…</p>
      </div>
    );
  }

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="mood"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      overlay={
        editing ? (
          <div className="modal capsule-manage-modal" role="dialog" aria-modal="true" aria-label="Administrar cápsula">
            <div className="modal-head">
              <div>
                <h2>Mi cápsula privada</h2>
                <p>Puedes editar el mensaje o cambiar la fecha antes de abrirla.</p>
              </div>
              <button className="close" type="button" onClick={() => setEditing(null)} aria-label="Cerrar">
                <Icon name="x" />
              </button>
            </div>

            <label className="field-label">
              Mensaje
              <textarea
                className="field"
                value={editContent}
                maxLength={5000}
                onChange={(event) => setEditContent(event.target.value)}
              />
            </label>

            <div className="capsule-options">
              <div>
                <label className="field-label" htmlFor="capsuleEditMood">
                  Emoción
                </label>
                <select
                  id="capsuleEditMood"
                  value={editMood}
                  onChange={(event) => setEditMood(event.target.value)}
                >
                  {MOODS.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.emoji} {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="capsuleEditDate">
                  Fecha de apertura
                </label>
                <input
                  id="capsuleEditDate"
                  type="date"
                  value={editDate}
                  min={dateOnly(new Date(Date.now() + 86_400_000))}
                  onChange={(event) => setEditDate(event.target.value)}
                />
              </div>
            </div>

            {editError ? (
              <p className="auth-error" role="alert">
                {editError}
              </p>
            ) : null}

            <div className="modal-actions capsule-manage-actions">
              <button className="ghost danger" type="button" onClick={() => confirmDelete(editing)}>
                Eliminar
              </button>
              <button className="primary" type="button" onClick={() => void saveEdit()} disabled={editSaving}>
                {editSaving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        ) : null
      }
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen capsules-page">
        <section className="card capsule-hero">
          <div>
            <span className="micro-label">PRIVADA POR DEFECTO</span>
            <h1>Mis cápsulas</h1>
            <div className="purpose-copy">
              <b>¿Para qué sirve?</b>
              <span>
                Guarda un mensaje privado para tu yo del futuro. Cuando llegue la fecha podrás
                recordar lo que sentías, lo que aprendiste y cuánto has cambiado.
              </span>
            </div>
          </div>
        </section>

        <section className="card capsule-editor">
          <label className="field-label" htmlFor="capsuleText">
            ¿Qué quieres decirle a tu yo futuro?
          </label>
          <textarea
            id="capsuleText"
            className="field"
            value={content}
            maxLength={5000}
            placeholder="Hoy me siento… Quiero recordar… Espero que cuando leas esto…"
            onChange={(event) => setContent(event.target.value)}
          />

          <div className="capsule-options">
            <div>
              <label className="field-label" htmlFor="capsuleDate">
                Abrir en
              </label>
              <select id="capsuleDate" value={dateChoice} onChange={(event) => setDateChoice(event.target.value)}>
                {DATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {dateChoice === 'custom' ? (
                <input
                  type="date"
                  value={customDate}
                  min={dateOnly(new Date(Date.now() + 86_400_000))}
                  onChange={(event) => setCustomDate(event.target.value)}
                  aria-label="Fecha personalizada de apertura"
                />
              ) : null}
            </div>
            <div>
              <label className="field-label" htmlFor="capsuleMood">
                Emoción de hoy
              </label>
              <select id="capsuleMood" value={mood} onChange={(event) => setMood(event.target.value)}>
                {MOODS.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.emoji} {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="privacy-explainer">
            <Icon name="lock" />
            <div>
              <b>Solo tú podrás abrirla</b>
              <span>Puedes editarla, aplazarla o eliminarla antes de la fecha.</span>
            </div>
          </div>

          {formError ? (
            <p className="auth-error" role="alert">
              {formError}
            </p>
          ) : null}

          <button className="primary capsule-save" type="button" onClick={() => void save()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cápsula'}
          </button>
        </section>

        <h2 className="discovery-section-title">Cápsulas guardadas</h2>

        {listLoading ? <p className="muted small">Cargando tus cápsulas…</p> : null}

        {!listLoading && error ? (
          <div className="auth-error" role="alert">
            {error}
            <button className="text-link" type="button" onClick={() => void load()} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        ) : null}

        {!listLoading && !error && capsules.length === 0 ? (
          <div className="empty-state">
            <h2>Aún no tienes cápsulas</h2>
            <p>Escribe un mensaje para tu yo futuro. Solo tú podrás leerlo cuando llegue la fecha.</p>
          </div>
        ) : null}

        {!listLoading && !error
          ? capsules.map((capsule) => {
              const isRevealed = revealed.has(capsule.id);
              const isOpen = capsule.isOpen || new Date(capsule.openAt).getTime() <= Date.now();
              return (
                <article className={`scheduled-capsule card${isOpen ? ' open' : ''}`} key={capsule.id}>
                  <div className="capsule-seal" aria-hidden>
                    <Icon name={isOpen ? 'calendar' : 'lock'} />
                  </div>
                  <div className="capsule-copy">
                    <span className="micro-label">
                      {remainingLabel(capsule).toUpperCase()}
                    </span>
                    <h2>{capsule.title}</h2>
                    <p>
                      Creada el {dateLabel(capsule.createdAt)} ·{' '}
                      {capsule.mood ? `${MOOD_EMOJI[capsule.mood] ?? ''} ${capsule.mood} · ` : ''}
                      Solo tú puedes verla
                    </p>
                    {isOpen && isRevealed ? <p className="capsule-content">{capsule.content}</p> : null}
                  </div>
                  <div className="capsule-actions">
                    {isOpen ? (
                      <button
                        className="secondary"
                        type="button"
                        onClick={() =>
                          setRevealed((prev) => {
                            const next = new Set(prev);
                            if (isRevealed) next.delete(capsule.id);
                            else next.add(capsule.id);
                            return next;
                          })
                        }
                      >
                        {isRevealed ? 'Ocultar' : 'Abrir cápsula'}
                      </button>
                    ) : null}
                    <button className="secondary" type="button" onClick={() => openManage(capsule)}>
                      Administrar
                    </button>
                  </div>
                </article>
              );
            })
          : null}
      </section>
    </WyFrame>
  );
}
