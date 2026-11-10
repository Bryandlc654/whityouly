'use client';
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import Icon from '@/components/wy/Icon';
import MiEspacioNav from '@/components/wy/MiEspacioNav';
import Guide58Modal from '@/components/wy/Guide58Modal';
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
  type EmotionalTrend,
} from '@/lib/emotionalMap';

type RangeDays = 1 | 7 | 30;

const RANGES: { id: RangeDays; label: string }[] = [
  { id: 1, label: 'Día' },
  { id: 7, label: 'Semana' },
  { id: 30, label: 'Mes' },
];

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
};
const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAYPART_LABELS: Record<string, string> = {
  madrugada: 'Madrugada',
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
};
const DAYPART_ORDER = ['madrugada', 'manana', 'tarde', 'noche'];

/** Color con transparencia para las celdas del mapa de momentos. */
function hexToRgba(hex: string | null | undefined, alpha: number): string {
  const fallback = `rgba(104, 71, 245, ${alpha})`;
  if (!hex) return fallback;
  const value = hex.replace('#', '');
  if (value.length !== 6) return fallback;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) return fallback;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/** Texto de la evolución: la intensidad sube, baja o se mantiene. */
function describeTrend(trend: EmotionalTrend | undefined): {
  title: string;
  detail: string;
  direction: EmotionalTrend['direction'];
} {
  if (!trend || trend.previousEntries === 0 || trend.previousAverageIntensity === null || trend.delta === null) {
    return {
      title: 'Aún sin comparación',
      detail: 'Cuando haya registros del periodo anterior verás aquí cómo cambia tu energía emocional.',
      direction: 'stable',
    };
  }

  const change =
    trend.topEmotionChanged && trend.previousTopEmotion
      ? ` Tu emoción más frecuente cambió: antes era «${trend.previousTopEmotion.name}».`
      : '';
  const from = trend.previousAverageIntensity;
  const to = Math.round((from + trend.delta) * 10) / 10;

  if (trend.direction === 'stable') {
    return {
      title: 'Se mantiene estable',
      detail: `Tu intensidad media sigue parecida: ${to}/10 frente a ${from}/10 del periodo anterior.${change}`,
      direction: 'stable',
    };
  }

  return {
    title: trend.direction === 'up' ? 'Energía al alza' : 'Energía a la baja',
    detail: `Tu intensidad media ${trend.direction === 'up' ? 'subió' : 'bajó'} ${Math.abs(trend.delta)} puntos: de ${from}/10 a ${to}/10.${change}`,
    direction: trend.direction,
  };
}

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

function moodEmoji(name: string | undefined | null): string {
  if (!name) return '📝';
  return MOOD_EMOJI[name] ?? '📝';
}

/** Emociones y colores de v58 (emotionConfig), en su orden. */
const EMOTIONS58: { name: string; emoji: string; color: string; soft: string }[] = [
  { name: 'Alegría', emoji: '😄', color: '#F4B942', soft: '#FFF6D9' },
  { name: 'Calma', emoji: '😌', color: '#42B8A8', soft: '#E2F7F3' },
  { name: 'Esperanza', emoji: '🌱', color: '#62B878', soft: '#E8F6EC' },
  { name: 'Neutral', emoji: '😐', color: '#8B95A7', soft: '#EEF0F4' },
  { name: 'Tristeza', emoji: '😔', color: '#5B84C4', soft: '#E7EFFB' },
  { name: 'Ansiedad', emoji: '😟', color: '#8B6CCF', soft: '#F0EAFB' },
  { name: 'Enojo', emoji: '😠', color: '#E06A5F', soft: '#FCEAE7' },
  { name: 'Soledad', emoji: '🫥', color: '#6670A8', soft: '#EAECF5' },
  { name: 'Cansancio', emoji: '😴', color: '#B08B68', soft: '#F5EEE7' },
];
const EMOTION58 = Object.fromEntries(EMOTIONS58.map((item) => [item.name, item]));

const pad2 = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Días de la semana actual (lunes a domingo), como weekKeys() de v58. */
function weekKeys(): string[] {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
}

/** Todos los días del mes actual, como monthKeys() de v58. */
function monthKeys(): string[] {
  const now = new Date();
  const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Array.from({ length: total }, (_, i) => dayKey(new Date(now.getFullYear(), now.getMonth(), i + 1)));
}

/** «10 de noviembre», como dateLabel() de v58. */
function dateLabel(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
}

/** Ventana en días que cubre la semana y el mes actuales. */
function summaryWindow(): number {
  const now = new Date();
  return Math.max(now.getDate(), ((now.getDay() + 6) % 7) + 1, 7);
}

export default function EmotionalMapPage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);

  const [range, setRange] = useState<RangeDays>(7);
  const [summary, setSummary] = useState<EmotionalSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [logs, setLogs] = useState<EmotionalLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [logsError, setLogsError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [emotionFilter, setEmotionFilter] = useState('Esperanza');
  const [todayLogs, setTodayLogs] = useState<EmotionalLog[]>([]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayLogs, setDayLogs] = useState<EmotionalLog[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('Esperanza');
  const [formValue, setFormValue] = useState(7);
  const [formNote, setFormNote] = useState('');
  const [formDaypart, setFormDaypart] = useState('Ahora');
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

  const loadSummary = useCallback(async (_days: RangeDays) => {
    setSummaryLoading(true);
    const todayKey = dayKey(new Date());
    const [result, todayResult] = await Promise.all([
      getEmotionalSummary({ days: summaryWindow(), tzOffsetMinutes: timezoneOffsetMinutes() }),
      listEmotionalLogs({
        from: new Date(`${todayKey}T00:00:00`).toISOString(),
        to: new Date(`${todayKey}T23:59:59.999`).toISOString(),
        limit: 50,
      }),
    ]);
    if (todayResult.status === 'ok') setTodayLogs([...todayResult.data.items].reverse());
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

  // v58 abre el calendario con el día de hoy seleccionado.
  useEffect(() => {
    if (!loading) void loadDay(dayKey(new Date()));
  }, [loading, loadDay]);

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
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
        { label: 'Ayuda y soporte', icon: 'mail', onClick: () => router.push('/soporte') },
        { label: 'Configuración de la cuenta', icon: 'settings', onClick: () => router.push('/cuenta/configuracion') },
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
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'help':
        router.push('/ayuda');
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
    setFormDaypart('Ahora');
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
    notify('Registro movido a tu papelera privada. Puedes restaurarlo en Mi diario.');
    await loadSummary(range);
  };

  const visibleLogs = useMemo(() => {
    if (emotionFilter === 'ALL') return logs;
    return logs.filter((log) => log.emotion.name === emotionFilter);
  }, [logs, emotionFilter]);

  const byDay = useMemo(
    () => new Map((summary?.days ?? []).map((day) => [day.date.slice(0, 10), day])),
    [summary],
  );
  const periodName = range === 1 ? 'Día' : range === 30 ? 'Mes' : 'Semana';
  const periodKeys = range === 1 ? [dayKey(new Date())] : range === 30 ? monthKeys() : weekKeys();

  /** Barras del periodo, como slotsFor() de v58. */
  const slots: { key: string; label: string; value: number | null; emotion: string | null }[] =
    range === 1
      ? todayLogs.map((log) => ({
          key: log.id,
          label: formatTime(log.loggedAt),
          value: log.intensity,
          emotion: log.emotion.name,
        }))
      : periodKeys.map((key) => {
          const day = byDay.get(key);
          const has = Boolean(day && day.entries > 0);
          return {
            key,
            label:
              range === 30
                ? String(Number(key.slice(-2)))
                : new Date(`${key}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'narrow' }).toUpperCase(),
            value: has ? Math.round(day?.averageIntensity ?? 0) : null,
            emotion: has ? day?.emotion?.name ?? null : null,
          };
        });

  const periodCount =
    range === 1 ? todayLogs.length : periodKeys.reduce((sum, key) => sum + (byDay.get(key)?.entries ?? 0), 0);
  const periodEmotion = (() => {
    const counts = new Map<string, number>();
    for (const slot of slots) if (slot.emotion) counts.set(slot.emotion, (counts.get(slot.emotion) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  })();

  const trendColors = EMOTION58[emotionFilter] ?? EMOTION58.Esperanza;
  const trendPoints = slots.filter((slot) => slot.emotion === emotionFilter && slot.value !== null);
  const today = dayKey(new Date());
  const days = monthKeys();
  const monthTitle = new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

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
          onMood={() => setRange(30)}
        />
      }
    >
      <section className="screen diary-summary">
        <MiEspacioNav active="mood" />

        <header className="diary-heading summary-heading57 space-description">
          <div className="summary-heading-copy57">
            <span className="diary-private">
              <Icon name="lock" /> Solo para ti
            </span>
            <h1>Mi resumen emocional</h1>
            <p>
              Consulta tus registros emocionales, gráficas y calendario. Puedes registrar otro
              momento cuando quieras.
            </p>
          </div>
          <div className="summary-actions57">
            <button
              className="primary emotion-register50"
              type="button"
              onClick={() => openCreate()}
            >
              <Icon name="pulse" /> Registrar cómo me siento
            </button>
            <button
              className="text-link summary-diary-link57"
              type="button"
              onClick={() => router.push('/mi-diario')}
            >
              Volver a mi diario
            </button>
          </div>
          <button className="guide-btn" type="button" onClick={() => setGuideOpen(true)}>
            <Icon name="help" />
            <span>Cómo usarlo</span>
          </button>
        </header>

        <div className="period-row">
          <div className="segmented" role="tablist" aria-label="Periodo">
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
          <div className="auth-error" role="alert">
            {summaryError}
            <button
              className="text-link"
              type="button"
              onClick={() => void loadSummary(range)}
              style={{ marginLeft: 8 }}
            >
              Reintentar
            </button>
          </div>
        ) : null}

        <section className="chart-card card">
          <div className="chart-head">
            <div>
              <h2>Resumen de {periodName.toLowerCase()}</h2>
              <p>Cada color representa una emoción; la altura representa intensidad.</p>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: '#62B878' }} /> Intensidad 1–10
              </span>
            </div>
          </div>

          <div className={`bar-chart emotion-chart ${range === 30 ? 'month-bars' : ''}`}>
            {slots.length ? (
              slots.map((slot) => (
                <div
                  className="bar-col"
                  key={slot.key}
                  aria-label={slot.value !== null ? `${slot.emotion}, intensidad ${slot.value} de 10` : 'Sin registro'}
                >
                  <b>{slot.value !== null ? slot.value : '—'}</b>
                  <i
                    style={
                      {
                        '--h': `${slot.value !== null ? slot.value * 8.5 : 2}%`,
                        '--bar': slot.value !== null ? EMOTION58[slot.emotion ?? '']?.color ?? '#6246F5' : '#E5E7EB',
                      } as CSSProperties
                    }
                  />
                  <small>{slot.label}</small>
                </div>
              ))
            ) : (
              <p>Hoy todavía no has registrado cómo te sientes.</p>
            )}
          </div>

          <div className="chart-foot">
            <span>
              {periodEmotion ? (
                <>
                  Emoción frecuente:{' '}
                  <b>
                    {periodEmotion} {EMOTION58[periodEmotion]?.emoji ?? moodEmoji(periodEmotion)}
                  </b>
                </>
              ) : (
                'Sin registros en este periodo'
              )}
            </span>
            <span>{periodCount} registros</span>
          </div>
        </section>

        <section
          className="chart-card card emotion-line-card"
          style={{ '--trend': trendColors.color, '--trend-soft': trendColors.soft } as CSSProperties}
        >
          <div className="chart-head">
            <div>
              <h2>Tendencia por emoción</h2>
              <p>Selecciona una emoción específica. No se mezclan emociones opuestas en un solo puntaje.</p>
            </div>
            <select
              className="emotion-select"
              id="emotionSelect"
              value={emotionFilter}
              onChange={(event) => setEmotionFilter(event.target.value)}
              aria-label="Emoción"
            >
              {EMOTIONS58.map((emotion) => (
                <option key={emotion.name} value={emotion.name}>
                  {emotion.emoji} {emotion.name}
                </option>
              ))}
            </select>
          </div>

          <div className="line-chart">
            {trendPoints.length ? (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <polyline
                  points={slots
                    .map((slot, index) =>
                      slot.emotion === emotionFilter && slot.value !== null
                        ? `${slots.length === 1 ? 50 : (index / (slots.length - 1)) * 100},${100 - slot.value * 8.5}`
                        : null,
                    )
                    .filter(Boolean)
                    .join(' ')}
                  fill="none"
                  stroke="var(--trend)"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ) : (
              <p className="no-emotion-data">No hay registros de {emotionFilter.toLowerCase()} en este periodo.</p>
            )}
          </div>
          <div className="insight">
            {trendPoints.length
              ? `${emotionFilter}: ${trendPoints.length} ${trendPoints.length === 1 ? 'registro' : 'registros'} en este periodo.`
              : 'Puedes elegir otra emoción o registrar cómo te sientes ahora.'}
          </div>
        </section>

        <section className="chart-card card">
          <div className="chart-head">
            <div>
              <h2>Tu mapa emocional — {monthTitle}</h2>
              <p>Color: emoción predominante. Saturación: intensidad registrada.</p>
            </div>
            <button className="guide-btn" type="button" onClick={() => setGuideOpen(true)}>
              <Icon name="help" />
              <span>Guía</span>
            </button>
          </div>

          <div className="calendar">
            {WEEKDAYS.map((label) => (
              <div className="weekday" key={label}>
                {label}
              </div>
            ))}
            {Array.from({ length: mondayIndex(days[0]) }).map((_, index) => (
              <div key={`pad-${index}`} />
            ))}
            {days.map((key) => {
              const day = byDay.get(key);
              const has = Boolean(day && day.entries > 0);
              const cfg = has ? EMOTION58[day?.emotion?.name ?? ''] : null;
              const value = has ? Math.round(day?.averageIntensity ?? 0) : null;
              return (
                <button
                  key={key}
                  type="button"
                  className={`day ${has ? '' : 'empty-day'} ${selectedDay === key ? 'selected' : ''}`}
                  disabled={key > today}
                  style={{ '--c': cfg?.soft ?? '#FFF', '--edge': cfg?.color ?? '#E5E7EB' } as CSSProperties}
                  onClick={() => void loadDay(key)}
                  aria-label={`${dateLabel(key)}: ${has ? `${day?.emotion?.name ?? ''} ${value}/10` : 'sin registro'}`}
                >
                  <b>{Number(key.slice(-2))}</b>
                  {has ? (
                    <>
                      <span>{cfg?.emoji ?? moodEmoji(day?.emotion?.name)}</span>
                      <small>{value}/10</small>
                    </>
                  ) : (
                    <small>—</small>
                  )}
                </button>
              );
            })}
          </div>

          <div className="calendar-legend">
            {EMOTIONS58.map((emotion) => (
              <span key={emotion.name} style={{ '--dot': emotion.color } as CSSProperties}>
                {emotion.emoji} {emotion.name}
              </span>
            ))}
          </div>

          {selectedDay ? (
            <div className="day-detail show">
              <h3>{dateLabel(selectedDay)}</h3>
              {dayLoading ? (
                <p>Cargando…</p>
              ) : dayLogs.length === 0 ? (
                <p>No hay registros en este día.</p>
              ) : (
                dayLogs.map((log) => (
                  <div className="timeline-item" key={log.id}>
                    <time>{formatTime(log.loggedAt)}</time>
                    <div>
                      <b>
                        {EMOTION58[log.emotion.name]?.emoji ?? moodEmoji(log.emotion.name)} {log.emotion.name} ·{' '}
                        {log.intensity}/10
                      </b>
                      {log.contextNote ? <p>{log.contextNote}</p> : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>

        {guideOpen ? (
          <div className="modal-layer">
            <Guide58Modal type="summary" onClose={() => setGuideOpen(false)} />
          </div>
        ) : null}
      </section>
    </WyFrame>
  );
}
