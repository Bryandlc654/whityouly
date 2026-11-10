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
import GuideModal from '@/components/wy/GuideModal';
import { GUIDES } from '@/lib/guideContent';
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
    notify('Registro movido a tu papelera privada. Puedes restaurarlo en Mi diario.');
    await loadSummary(range);
  };

  const visibleLogs = useMemo(() => {
    if (emotionFilter === 'ALL') return logs;
    return logs.filter((log) => log.emotion.name === emotionFilter);
  }, [logs, emotionFilter]);

  const bars = useMemo(() => {
    if (!summary) return [];
    // El gráfico cubre todo el periodo elegido, igual que el resumen.
    return summary.days;
  }, [summary]);

  // Con muchos días no se puede etiquetar cada barra; se muestran unas pocas.
  const barLabelEvery = Math.max(1, Math.ceil(bars.length / 12));

  const dominant = summary?.emotions[0] ?? null;

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
          onToggleSummary={() => notify('Tu resumen es privado: solo tú lo ves.')}          onMood={() => setRange(30)}
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
              <h2>Resumen de semana</h2>
              <p>Cada color representa una emoción; la altura representa intensidad.</p>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: '#37a978' }} /> Intensidad 1–10
              </span>
            </div>
          </div>

          <div
            className={`bar-chart emotion-chart${
              !summary || summary.totalEntries === 0 ? ' is-empty' : ''
            }`}
          >
            {bars.map((day, index) => (
              <div
                className="bar-col"
                key={day.date}
                title={
                  day.averageIntensity !== null
                    ? `${formatDayLong(day.date)}: ${day.averageIntensity}/10`
                    : `${formatDayLong(day.date)}: sin registros`
                }
              >
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
                {day.averageIntensity !== null ? <b>{day.averageIntensity}</b> : null}
                <small>{WEEKDAYS[index % 7]}</small>
              </div>
            ))}
          </div>

          <div className="chart-foot">
            <span>
              {summary && summary.totalEntries > 0
                ? `Emoción frecuente: ${dominant?.name ?? 'Sin registros'}`
                : 'Sin registros en este periodo'}
            </span>
            <span>{summary?.totalEntries ?? 0} registros</span>
          </div>
        </section>

        <section className="chart-card card emotion-line-card">
          <div className="chart-head">
            <div>
              <h2>Evolución de una emoción</h2>
              <p>Elige una emoción para ver cómo cambió su intensidad.</p>
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

          {summary && summary.totalEntries > 0 ? (
            <div className="line-chart">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                <polyline
                  points={bars
                    .map((day, index) => {
                      const x = bars.length === 1 ? 50 : (index / (bars.length - 1)) * 100;
                      const y = 100 - (day.averageIntensity ?? 0) * 8;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#6246F5"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          ) : (
            <p className="no-emotion-data">
              No hay registros de {emotionFilter === 'ALL' ? 'emociones' : emotionFilter} en este
              periodo.
            </p>
          )}

          <div className="insight">
            Puedes elegir otra emoción o registrar cómo te sientes ahora.
          </div>
        </section>

        <section className="chart-card card">
          <div className="chart-head">
            <div>
              <h2>Tu calendario</h2>
              <p>El color de cada día refleja tu emoción dominante. Toca un día para ver el detalle.</p>
            </div>
          </div>

          <div className="calendar">
            {WEEKDAYS.map((label) => (
              <div className="weekday" key={label}>
                {label}
              </div>
            ))}
            {summary && summary.days.length > 0
              ? Array.from({ length: mondayIndex(summary.days[0].date) }).map((_, index) => (
                  <div key={`pad-${index}`} aria-hidden />
                ))
              : null}
            {(summary?.days ?? []).map((day) => (
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
            {(summary?.emotions ?? []).slice(0, 6).map((emotion) => (
              <span
                key={emotion.name}
                style={{ '--dot': emotion.colorHex ?? 'var(--purple)' } as CSSProperties}
              >
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
                <p className="muted small">No hay registros en este día.</p>
              ) : (
                dayLogs.map((log) => (
                  <div className="timeline-item" key={log.id}>
                    <span className="timeline-emoji">{moodEmoji(log.emotion.name)}</span>
                    <time>{formatTime(log.loggedAt)}</time>
                    <div>
                      <b>
                        {log.emotion.name} · {log.intensity}/10
                      </b>
                      {log.contextNote ? (
                        <p className="muted small" style={{ margin: '3px 0 0' }}>
                          {log.contextNote}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>

        {guideOpen ? (
          <div className="modal-layer">
            <GuideModal guide={GUIDES.mood} onClose={() => setGuideOpen(false)} />
          </div>
        ) : null}
      </section>
    </WyFrame>
  );
}
