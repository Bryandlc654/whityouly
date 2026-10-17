'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import Icon from '@/components/wy/Icon';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import MoodModal, { MOOD_EMOJI } from '@/components/wy/MoodModal';
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

type RangeDays = 7 | 30 | 90;

const RANGES: { id: RangeDays; label: string }[] = [
  { id: 7, label: '7 días' },
  { id: 30, label: '30 días' },
  { id: 90, label: '90 días' },
];

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MAX_BARS = 30;

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDayLong(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const label = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shortDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric' }).format(date);
}

/** Índice de columna (0 = lunes) de una fecha local en formato YYYY-MM-DD. */
function mondayIndex(date: string): number {
  const day = new Date(`${date}T00:00:00`).getDay();
  return (day + 6) % 7;
}

function tint(colorHex: string | null | undefined, fallback: string): string {
  return colorHex ? `${colorHex}33` : fallback;
}

export default function EmotionalMapPage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [range, setRange] = useState<RangeDays>(30);
  const [summary, setSummary] = useState<EmotionalSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [logs, setLogs] = useState<EmotionalLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [logsError, setLogsError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [emotionFilter, setEmotionFilter] = useState('ALL');

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayLogs, setDayLogs] = useState<EmotionalLog[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('Esperanza');
  const [formValue, setFormValue] = useState(7);
  const [formNote, setFormNote] = useState('');
  const [formDaypart, setFormDaypart] = useState('Todo el día');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const loadSummary = useCallback(async (days: RangeDays) => {
    setSummaryLoading(true);
    const result = await getEmotionalSummary({ days, tzOffsetMinutes: timezoneOffsetMinutes() });
    setSummaryLoading(false);

    if (result.status !== 'ok') {
      setSummaryError(result.message);
      return;
    }
    setSummaryError('');
    setSummary(result.data);
  }, []);

  const loadRecentLogs = useCallback(async () => {
    const result = await listEmotionalLogs({ limit: 20 });
    if (result.status !== 'ok') {
      setLogsError(result.message);
      return;
    }
    setLogsError('');
    setLogs(result.data.items);
    setNextCursor(result.data.nextCursor);
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
        if (res.ok) setCharacter(await res.json());
      } catch (error) {
        console.error('Error verificando sesión', error);
      } finally {
        setLoading(false);
      }
    };

    void verify();
  }, [router]);

  useEffect(() => {
    if (!loading) void loadRecentLogs();
  }, [loading, loadRecentLogs]);

  useEffect(() => {
    if (!loading) void loadSummary(range);
  }, [loading, range, loadSummary]);

  const loadDay = useCallback(
    async (date: string) => {
      setSelectedDay(date);
      setDayLoading(true);
      const from = new Date(`${date}T00:00:00`).toISOString();
      const to = new Date(`${date}T23:59:59.999`).toISOString();
      const result = await listEmotionalLogs({ from, to, limit: 50 });
      setDayLoading(false);

      if (result.status !== 'ok') {
        notify(result.message);
        setDayLogs([]);
        return;
      }
      setDayLogs(result.data.items);
    },
    [notify],
  );

  const refresh = useCallback(async () => {
    await Promise.all([loadSummary(range), loadRecentLogs()]);
    if (selectedDay) void loadDay(selectedDay);
  }, [range, selectedDay, loadSummary, loadRecentLogs, loadDay]);

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
        { label: 'Configuración de la cuenta', icon: 'settings', onClick: () => router.push('/cuenta') },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        router.push('/feed');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'mood':
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const openCreate = (name = 'Esperanza') => {
    setEditingId(null);
    setFormName(name);
    setFormValue(7);
    setFormNote('');
    setFormDaypart('Todo el día');
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (log: EmotionalLog) => {
    setEditingId(log.id);
    setFormName(log.emotion.name);
    setFormValue(log.intensity);
    setFormNote(log.contextNote ?? '');
    setFormError('');
    setModalOpen(true);
  };

  const saveModal = async () => {
    setSaving(true);
    setFormError('');

    const result = editingId
      ? await updateEmotionalLog(editingId, {
          emotion: formName,
          intensity: formValue,
          contextNote: formNote,
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
    notify(editingId ? 'Registro actualizado.' : `${formName} ${formValue}/10 guardado.`);
    await refresh();
  };

  const removeLog = async (log: EmotionalLog) => {
    setBusyId(log.id);
    const result = await deleteEmotionalLog(log.id);
    setBusyId(null);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setLogs((prev) => prev.filter((item) => item.id !== log.id));
    setDayLogs((prev) => prev.filter((item) => item.id !== log.id));
    notify('Registro eliminado.');
    await loadSummary(range);
  };

  const visibleLogs = useMemo(() => {
    if (emotionFilter === 'ALL') return logs;
    return logs.filter((log) => log.emotion.name === emotionFilter);
  }, [logs, emotionFilter]);

  const bars = useMemo(() => {
    if (!summary) return [];
    return summary.days.slice(-MAX_BARS);
  }, [summary]);

  const dominant = summary?.emotions[0] ?? null;
  const name = character?.name ?? '';

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
            onSave={() => void saveModal()}
            onClose={() => setModalOpen(false)}
          />
        ) : null
      }
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={false}
          onToggleSummary={() => notify('Tu resumen es privado: solo tú lo ves.')}
          onDaily={() => notify('La consigna diaria llega con el módulo de historias.')}
          onCategory={(category) => notify(`Explorar «${category}» llega pronto.`)}
          onMood={() => setRange(90)}
        />
      }
    >
      <section className="screen">
        <div className="card mood-hero">
          <div>
            <h1>Mi mapa emocional</h1>
            <p>
              {loading
                ? 'Cargando tu diario…'
                : name
                  ? `${name}, este es tu espacio privado para mirar cómo te has sentido.`
                  : 'Tu diario privado de estados de ánimo.'}
            </p>
          </div>
          <button type="button" onClick={() => openCreate()}>
            <Icon name="plus" /> Registrar cómo me siento
          </button>
        </div>

        {!loading ? (
          <div className="card" style={{ padding: 16 }}>
            <div className="period-row">
              <div>
                <span className="privacy-badge">
                  <Icon name="lock" /> Solo tú puedes verlo
                </span>
              </div>
              <span className="muted small">
                {summary
                  ? `Racha de ${summary.currentStreak} ${summary.currentStreak === 1 ? 'día' : 'días'} · Promedio ${summary.averageIntensity ?? '—'}/10`
                  : 'Sin datos todavía'}
              </span>
            </div>
          </div>
        ) : null}

        <div className="card chart-card">
          <div className="chart-head">
            <div>
              <h2>Intensidad emocional</h2>
              <p>Promedio diario de tus registros en 1 a 10.</p>
            </div>
            <div className="segmented" role="tablist" aria-label="Rango de tiempo">
              {RANGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={range === item.id ? 'active' : undefined}
                  aria-current={range === item.id ? 'true' : undefined}
                  onClick={() => setRange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {summaryError ? (
            <div className="auth-error" role="alert" style={{ marginTop: 12 }}>
              {summaryError}
              <button className="text-link" type="button" onClick={() => void loadSummary(range)} style={{ marginLeft: 8 }}>
                Reintentar
              </button>
            </div>
          ) : null}

          {!summaryError && bars.every((day) => day.entries === 0) && !summaryLoading ? (
            <p className="muted small" style={{ marginTop: 16 }}>
              Aún no hay registros en este periodo. Empieza registrando cómo te sientes hoy.
            </p>
          ) : null}

          {bars.some((day) => day.entries > 0) ? (
            <div className="bar-chart">
              {bars.map((day) => (
                <div className="bar-col" key={day.date}>
                  {day.averageIntensity !== null ? <b>{day.averageIntensity}</b> : null}
                  <i
                    style={
                      {
                        '--h': `${(day.averageIntensity ?? 0) * 8}%`,
                        background: day.emotion?.colorHex
                          ? `linear-gradient(${day.emotion.colorHex}, ${day.emotion.colorHex}cc)`
                          : undefined,
                      } as CSSProperties
                    }
                  />
                  <small>{shortDay(day.date)}</small>
                </div>
              ))}
            </div>
          ) : null}

          {dominant ? (
            <div className="insight">
              <b>{dominant.name}</b> es la emoción más frecuente del periodo ({dominant.count}{' '}
              {dominant.count === 1 ? 'registro' : 'registros'}). Tu intensidad media es{' '}
              <b>{summary?.averageIntensity ?? '—'}/10</b>.
            </div>
          ) : null}

          {summary && summary.emotions.length > 0 ? (
            <div className="legend" style={{ marginTop: 14, flexWrap: 'wrap' }}>
              {summary.emotions.slice(0, 6).map((emotion) => (
                <span key={emotion.name}>
                  <i style={{ background: emotion.colorHex ?? 'var(--purple)' }} />
                  {emotion.name} · {emotion.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {summary && summary.days.length > 0 ? (
          <div className="card chart-card">
            <div className="chart-head">
              <div>
                <h2>Tu calendario</h2>
                <p>El color de cada día refleja tu emoción dominante. Toca un día para ver el detalle.</p>
              </div>
            </div>

            <div className="calendar">
              {WEEKDAYS.map((label) => (
                <span className="weekday" key={label}>
                  {label}
                </span>
              ))}
              {Array.from({ length: mondayIndex(summary.days[0].date) }).map((_, index) => (
                <span key={`pad-${index}`} aria-hidden />
              ))}
              {summary.days.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  className={`day${selectedDay === day.date ? ' selected' : ''}`}
                  style={{ '--c': tint(day.emotion?.colorHex, '#f6f5f8') } as CSSProperties}
                  onClick={() => void loadDay(day.date)}
                  aria-label={formatDayLong(day.date)}
                >
                  <b>{shortDay(day.date)}</b>
                  {day.entries > 0 ? <small>{day.entries}</small> : null}
                </button>
              ))}
            </div>

            <div className="calendar-legend">
              {summary.emotions.slice(0, 6).map((emotion) => (
                <span key={emotion.name} style={{ '--dot': emotion.colorHex ?? 'var(--purple)' } as CSSProperties}>
                  {emotion.name}
                </span>
              ))}
            </div>

            {selectedDay ? (
              <div className="day-detail show">
                <h3>{formatDayLong(selectedDay)}</h3>
                {dayLoading ? (
                  <p className="muted small">Cargando…</p>
                ) : dayLogs.length === 0 ? (
                  <p className="muted small">No registraste emociones ese día.</p>
                ) : (
                  dayLogs.map((log) => (
                    <div className="timeline-item" key={log.id}>
                      <time>{formatTime(log.loggedAt)}</time>
                      <div>
                        <b>
                          {MOOD_EMOJI[log.emotion.name] ?? '•'} {log.emotion.name} · {log.intensity}/10
                        </b>
                        {log.contextNote ? <p className="muted small" style={{ margin: '3px 0 0' }}>{log.contextNote}</p> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="card chart-card">
          <div className="chart-head">
            <div>
              <h2>Mis registros</h2>
              <p>Lo más reciente de tu diario emocional.</p>
            </div>
            <select
              className="emotion-select"
              value={emotionFilter}
              onChange={(event) => setEmotionFilter(event.target.value)}
              aria-label="Filtrar por emoción"
            >
              <option value="ALL">Todas las emociones</option>
              {(summary?.emotions ?? []).map((emotion) => (
                <option key={emotion.name} value={emotion.name}>
                  {emotion.name}
                </option>
              ))}
            </select>
          </div>

          {logsError ? (
            <div className="auth-error" role="alert" style={{ marginTop: 12 }}>
              {logsError}
              <button className="text-link" type="button" onClick={() => void loadRecentLogs()} style={{ marginLeft: 8 }}>
                Reintentar
              </button>
            </div>
          ) : null}

          {!logsError && visibleLogs.length === 0 ? (
            <div className="empty card" style={{ marginTop: 14, boxShadow: 'none' }}>
              <div className="empty-icon">
                <Icon name="pulse" />
              </div>
              <h2>Tu diario está en blanco</h2>
              <p>Registrar cómo te sientes toma unos segundos y solo lo ves tú.</p>
              <button className="primary" type="button" style={{ padding: '12px 18px' }} onClick={() => openCreate()}>
                Registrar mi primer estado
              </button>
            </div>
          ) : null}

          {visibleLogs.map((log) => (
            <div className="timeline-item" key={log.id}>
              <time>{formatTime(log.loggedAt)}</time>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <b>
                    {MOOD_EMOJI[log.emotion.name] ?? '•'} {log.emotion.name} · {log.intensity}/10
                  </b>
                  {log.contextNote ? (
                    <p className="muted small" style={{ margin: '3px 0 0' }}>
                      {log.contextNote}
                    </p>
                  ) : null}
                </div>
                <div className="comment-actions">
                  <button type="button" disabled={busyId === log.id} onClick={() => openEdit(log)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={busyId === log.id}
                    onClick={() => void removeLog(log)}
                    style={{ color: '#a94a4a' }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}

          {nextCursor ? (
            <div style={{ marginTop: 14 }}>
              <button
                className="btn-outline"
                type="button"
                disabled={loadingMore || emotionFilter !== 'ALL'}
                onClick={() => {
                  if (emotionFilter !== 'ALL') return;
                  setLoadingMore(true);
                  void listEmotionalLogs({ cursor: nextCursor, limit: 20 })
                    .then((result) => {
                      if (result.status !== 'ok') {
                        notify(result.message);
                        return;
                      }
                      setLogs((prev) => [...prev, ...result.data.items]);
                      setNextCursor(result.data.nextCursor);
                    })
                    .finally(() => setLoadingMore(false));
                }}
              >
                {loadingMore ? 'Cargando…' : 'Ver más'}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </WyFrame>
  );
}
