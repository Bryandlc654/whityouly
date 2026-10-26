'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Icon from '@/components/wy/Icon';
import MoodModal, { MOOD_EMOJI } from '@/components/wy/MoodModal';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import {
  createEmotionalLog,
  daypartToLoggedAt,
  deleteEmotionalLog,
  getEmotionalSummary,
  listEmotionalLogs,
  timezoneOffsetMinutes,
  updateEmotionalLog,
  type EmotionalLog,
  type EmotionalSummary,
} from '@/lib/emotionalMap';

const DAYPART = 'Todo el día';

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function dateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateLabel(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function DiaryPage() {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [logs, setLogs] = useState<EmotionalLog[]>([]);
  const [summary, setSummary] = useState<EmotionalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('Esperanza');
  const [formValue, setFormValue] = useState(7);
  const [formNote, setFormNote] = useState('');
  const [formDaypart, setFormDaypart] = useState(DAYPART);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

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
    const [logsResult, summaryResult] = await Promise.all([
      listEmotionalLogs({ limit: 100 }),
      getEmotionalSummary({ days: 30, tzOffsetMinutes: timezoneOffsetMinutes() }),
    ]);
    setListLoading(false);

    if (logsResult.status === 'ok') setLogs(logsResult.data.items);
    else {
      setLogs([]);
      setError(logsResult.message);
    }

    if (summaryResult.status === 'ok') setSummary(summaryResult.data);
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

  const openCreate = () => {
    setEditingId(null);
    setFormName('Esperanza');
    setFormValue(7);
    setFormNote('');
    setFormDaypart(DAYPART);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (log: EmotionalLog) => {
    setEditingId(log.id);
    setFormName(log.emotion.name);
    setFormValue(log.intensity);
    setFormNote(log.contextNote ?? '');
    setFormDaypart(DAYPART);
    setFormError('');
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setFormError('');

    const result = editingId
      ? await updateEmotionalLog(editingId, {
          emotion: formName,
          intensity: formValue,
          contextNote: formNote.trim(),
        })
      : await createEmotionalLog({
          emotion: formName,
          intensity: formValue,
          contextNote: formNote.trim() || undefined,
          loggedAt: daypartToLoggedAt(formDaypart),
        });

    setSaving(false);

    if (result.status !== 'ok') {
      setFormError(result.message);
      return;
    }

    setModalOpen(false);
    notify(editingId ? 'Entrada actualizada.' : 'Entrada guardada en tu diario.');
    await load();
  };

  const remove = async (id: string) => {
    setBusyId(id);
    const result = await deleteEmotionalLog(id);
    setBusyId(null);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setLogs((prev) => prev.filter((log) => log.id !== id));
    notify('Entrada eliminada.');
    await load();
  };

  const confirmDelete = (log: EmotionalLog) => {
    setSheet({
      title: '¿Eliminar esta entrada?',
      rows: [
        { label: 'Conservar entrada', icon: 'shield', onClick: () => setSheet(null) },
        {
          label: 'Eliminar definitivamente',
          icon: 'trash',
          danger: true,
          onClick: () => void remove(log.id),
        },
      ],
    });
  };

  const groups = logs.reduce<{ date: string; items: EmotionalLog[] }[]>((acc, log) => {
    const key = dateKey(log.loggedAt);
    const group = acc.find((item) => item.date === key);
    if (group) group.items.push(log);
    else acc.push({ date: key, items: [log] });
    return acc;
  }, []);

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
        modalOpen ? (
          <MoodModal
            name={formName}
            value={formValue}
            note={formNote}
            daypart={formDaypart}
            mode={editingId ? 'edit' : 'create'}
            saving={saving}
            error={formError}
            onChangeName={setFormName}
            onChangeValue={setFormValue}
            onChangeNote={setFormNote}
            onChangeDaypart={setFormDaypart}
            onSave={() => void save()}
            onClose={() => setModalOpen(false)}
          />
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
      <section className="screen diary-page">
        <div className="screen-heading">
          <div>
            <h1>Mi diario</h1>
            <p>Un registro privado de cómo te sientes, día a día.</p>
          </div>
          <button className="secondary" type="button" onClick={openCreate}>
            <Icon name="plus" /> Registrar
          </button>
        </div>

        {summary ? (
          <div className="diary-stats card">
            <div>
              <b>{summary.totalEntries}</b>
              <small>Entradas en 30 días</small>
            </div>
            <div>
              <b>{summary.currentStreak}</b>
              <small>{summary.currentStreak === 1 ? 'Día de constancia' : 'Días de constancia'}</small>
            </div>
            <div>
              <b>{summary.averageIntensity ?? '—'}</b>
              <small>Intensidad media /10</small>
            </div>
            <div>
              <b>{summary.emotions[0]?.name ?? '—'}</b>
              <small>Emoción frecuente</small>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="auth-error" role="alert">
            {error}
            <button className="text-link" type="button" onClick={() => void load()} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        ) : null}

        {listLoading ? <p className="muted small">Cargando tu diario…</p> : null}

        {!listLoading && !error && groups.length === 0 ? (
          <div className="empty-state">
            <h2>Tu diario está en blanco</h2>
            <p>Registra cómo te sientes hoy. Solo tú puedes leer lo que escribas aquí.</p>
            <button className="secondary" type="button" onClick={openCreate}>
              Crear la primera entrada
            </button>
          </div>
        ) : null}

        {!listLoading && !error
          ? groups.map((group) => (
              <section className="diary-day card" key={group.date}>
                <div className="diary-day-head">
                  <h2>{dateLabel(group.date)}</h2>
                  <span>
                    {group.items.length} {group.items.length === 1 ? 'entrada' : 'entradas'}
                  </span>
                </div>

                <div className="diary-entries">
                  {group.items.map((log) => (
                    <article className="diary-entry" key={log.id}>
                      <span className="diary-emoji" aria-hidden>
                        {MOOD_EMOJI[log.emotion.name] ?? '•'}
                      </span>
                      <div className="diary-entry-body">
                        <div className="diary-entry-meta">
                          <b>{log.emotion.name}</b>
                          <span>{log.intensity}/10</span>
                          <time>{timeLabel(log.loggedAt)}</time>
                        </div>
                        {log.contextNote ? <p>{log.contextNote}</p> : null}
                      </div>
                      <div className="diary-entry-actions">
                        <button
                          className="icon-btn"
                          type="button"
                          onClick={() => openEdit(log)}
                          aria-label="Editar entrada"
                          disabled={busyId === log.id}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className="icon-btn"
                          type="button"
                          onClick={() => confirmDelete(log)}
                          aria-label="Eliminar entrada"
                          disabled={busyId === log.id}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          : null}
      </section>
    </WyFrame>
  );
}
