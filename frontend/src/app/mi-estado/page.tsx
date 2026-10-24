'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'help':
        router.push('/soporte');
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
    // El gráfico cubre todo el periodo elegido, igual que el resumen.
    return summary.days;
  }, [summary]);

  // Con muchos días no se puede etiquetar cada barra; se muestran unas pocas.
  const barLabelEvery = Math.max(1, Math.ceil(bars.length / 12));

  const dominant = summary?.emotions[0] ?? null;

  const weekdayMoments = summary?.weekdays ?? [];
  const daypartMoments = summary?.dayparts ?? [];
  const heatmap = summary?.heatmap ?? [];
  const maxMomentEntries = Math.max(1, ...weekdayMoments.map((moment) => moment.entries));
  const heatmapMax = Math.max(1, ...heatmap.map((cell) => cell.entries));
  const topEmotionCount = dominant?.count ?? 1;
  const trendInfo = describeTrend(summary?.trend);
  const busiestCell = heatmap
    .filter((cell) => cell.entries > 0)
    .sort((a, b) => b.entries - a.entries)[0] ?? null;

  const recommendation = (() => {
    switch (dominant?.name) {
      case 'Ansiedad':
        return {
          icon: 'pulse' as const,
          title: 'Respira conmigo',
          copy: 'Una pausa breve para bajar el ritmo y volver al momento presente.',
        };
      case 'Tristeza':
        return {
          icon: 'heart' as const,
          title: 'Un espacio para ti',
          copy: 'Una actividad suave para acompañar la tristeza sin exigirte.',
        };
      case 'Calma':
        return {
          icon: 'sparkle' as const,
          title: 'Sostén esta calma',
          copy: 'Registra qué te ayudó a llegar aquí para poder volver a ello.',
        };
      case 'Esperanza':
        return {
          icon: 'sparkle' as const,
          title: 'Cuida lo que está creciendo',
          copy: 'Anota el pequeño paso que te dio un poco de luz esta semana.',
        };
      default:
        return {
          icon: 'sparkle' as const,
          title: 'Un momento para ti',
          copy: 'Elige una práctica breve para acompañar lo que sientes hoy.',
        };
    }
  })();

  const rangeLabel = RANGES.find((item) => item.id === range)?.label.toLowerCase() ?? 'semana';

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
      <section className="screen mood-page">
        <nav className="emotion-nav card" aria-label="Mi espacio personal">
          <button className="active" type="button">
            <Icon name="pulse" />
            <span>Resumen</span>
          </button>
          <button type="button" onClick={() => router.push('/pulso')}>
            <Icon name="heart" />
            <span>Actividades</span>
          </button>
          <button type="button" onClick={() => router.push('/mi-arbol')}>
            <Icon name="trend" />
            <span>Mi árbol</span>
          </button>
        </nav>

        <section className="card mood-hero">
          <div className="mood-hero-copy">
            <span className="micro-label">TU ESPACIO PRIVADO</span>
            <h1>Mi espacio emocional</h1>
            <div className="purpose-copy">
              <b>¿Para qué sirve?</b>
              <span>
                Registra cómo te sientes, recibe una actividad relacionada con ese momento y observa
                tus cambios con el tiempo. No es un diagnóstico.
              </span>
            </div>
          </div>
          <div className="hero-actions">
            <button className="primary mood-hero-cta" type="button" onClick={() => openCreate()}>
              <Icon name="plus" /> Registrar ahora
            </button>
          </div>
        </section>

        <div className="care-cycle card" aria-label="Recorrido de Mi espacio">
          <span><b>1</b> Registrar</span>
          <i />
          <span><b>2</b> Elegir</span>
          <i />
          <span><b>3</b> Practicar</span>
          <i />
          <span><b>4</b> Observar</span>
          <i />
          <span><b>5</b> Crecer</span>
        </div>

        <section className="recommended-card card mood-recommendation">
          <div className="recommended-icon">
            <Icon name={recommendation.icon} />
          </div>
          <div className="recommended-copy">
            <span className="micro-label">
              {dominant ? 'RECOMENDADO SEGÚN TU ÚLTIMO REGISTRO' : 'RECOMENDADO PARA HOY'}
            </span>
            <h3>{recommendation.title}</h3>
            <p>{recommendation.copy}</p>
            {dominant ? (
              <small>
                {dominant.name} · {dominant.count} {dominant.count === 1 ? 'registro' : 'registros'}
              </small>
            ) : null}
          </div>
          <button className="secondary" type="button" onClick={() => router.push('/pulso')}>
            Abrir actividad
          </button>
        </section>

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
          <span className="privacy-badge">
            <Icon name="lock" /> Solo tú puedes verlo
          </span>
        </div>

        {/* Intensidad y tendencia */}
        <div className="card chart-card">
          <div className="chart-head">
            <div className="mood-section-title">
              <span className="mood-section-icon">
                <Icon name="trend" />
              </span>
              <div>
                <h2>Resumen de {range === 1 ? 'hoy' : `la ${rangeLabel}`}</h2>
                <p>Cada color representa una emoción; la altura representa intensidad.</p>
              </div>
            </div>
          </div>

          {summaryError ? (
            <div className="auth-error" role="alert" style={{ marginTop: 14 }}>
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
            <div
              className="bar-chart"
              style={
                bars.length > 31
                  ? { gap: 3, overflowX: 'auto', paddingBottom: 4 }
                  : undefined
              }
            >
              {bars.map((day, index) => (
                <div
                  className="bar-col"
                  key={day.date}
                  style={bars.length > 31 ? { minWidth: 8 } : undefined}
                  title={
                    day.averageIntensity !== null
                      ? `${formatDayLong(day.date)}: ${day.averageIntensity}/10`
                      : `${formatDayLong(day.date)}: sin registros`
                  }
                >
                  {day.averageIntensity !== null && index % barLabelEvery === 0 ? (
                    <b>{day.averageIntensity}</b>
                  ) : null}
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
                  {index % barLabelEvery === 0 || index === bars.length - 1 ? (
                    <small>{shortDay(day.date)}</small>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {summary ? (
            <div className="chart-foot">
              <span>
                Emoción frecuente: <b>{dominant?.name ?? 'Sin registros'}</b>
              </span>
              <span>
                {summary.totalEntries} {summary.totalEntries === 1 ? 'registro' : 'registros'}
              </span>
            </div>
          ) : null}

          {summary && summary.totalEntries > 0 ? (
            <div className={`trend trend-${trendInfo.direction}`}>
              <span className="trend-icon" aria-hidden>
                {trendInfo.direction === 'up' ? '↑' : trendInfo.direction === 'down' ? '↓' : '→'}
              </span>
              <div>
                <b>{trendInfo.title}</b>
                <p className="muted small">{trendInfo.detail}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Emociones del periodo */}
        {summary && summary.emotions.length > 0 ? (
          <div className="card chart-card">
            <div className="chart-head">
              <div className="mood-section-title">
                <span className="mood-section-icon">
                  <Icon name="sparkle" />
                </span>
                <div>
                  <h2>Emociones del periodo</h2>
                  <p>Las que más registraste en los últimos {range} días.</p>
                </div>
              </div>
            </div>

            {dominant ? (
              <div className="insight">
                <b>{dominant.name}</b> es tu emoción más frecuente ({dominant.count}{' '}
                {dominant.count === 1 ? 'registro' : 'registros'}). Tu intensidad media es{' '}
                <b>{summary.averageIntensity ?? '—'}/10</b>.
              </div>
            ) : null}

            <div className="rank" aria-label="Emociones más frecuentes">
              {summary.emotions.slice(0, 6).map((emotion) => {
                const share =
                  summary.totalEntries > 0 ? Math.round((emotion.count / summary.totalEntries) * 100) : 0;
                const width = Math.round((emotion.count / topEmotionCount) * 100);
                const color = emotion.colorHex ?? 'var(--purple)';
                return (
                  <div className="rank-row" key={emotion.name}>
                    <span className="rank-name">
                      <i style={{ background: color }} />
                      {emotion.name}
                    </span>
                    <span className="rank-bar">
                      <b style={{ width: `${width}%`, background: color }} />
                    </span>
                    <span className="rank-value">
                      {emotion.count} · {share}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Calendario */}
        {summary && summary.days.length > 0 ? (
          <div className="card chart-card">
            <div className="chart-head">
              <div className="mood-section-title">
                <span className="mood-section-icon">
                  <Icon name="calendar" />
                </span>
                <div>
                  <h2>Tu calendario</h2>
                  <p>El color de cada día refleja tu emoción dominante. Toca un día para ver el detalle.</p>
                </div>
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
          </div>
        ) : null}

        {/* Momentos recurrentes */}
        {summary && summary.totalEntries > 0 ? (
          <div className="card chart-card">
            <div className="chart-head">
              <div className="mood-section-title">
                <span className="mood-section-icon">
                  <Icon name="pulse" />
                </span>
                <div>
                  <h2>Momentos recurrentes</h2>
                  <p>Cuándo sueles registrar emociones: día de la semana y franja del día.</p>
                </div>
              </div>
            </div>

            <div className="moment-grid" aria-label="Registros por día de la semana">
              {weekdayMoments.map((moment) => (
                <div
                  className="moment-col"
                  key={moment.key}
                  title={`${WEEKDAY_LABELS[moment.key] ?? moment.key}: ${moment.entries} ${moment.entries === 1 ? 'registro' : 'registros'}`}
                  style={{ '--h': `${(moment.entries / maxMomentEntries) * 100}%` } as CSSProperties}
                >
                  <b>{moment.entries}</b>
                  <i
                    style={{
                      background: moment.topEmotion?.colorHex
                        ? `linear-gradient(${moment.topEmotion.colorHex}, ${moment.topEmotion.colorHex}cc)`
                        : undefined,
                    }}
                  />
                  <small>{WEEKDAY_LABELS[moment.key] ?? moment.key}</small>
                </div>
              ))}
            </div>

            <div className="daypart-row">
              {daypartMoments.map((moment) => (
                <div className="daypart-chip" key={moment.key}>
                  <span className="daypart-label">{DAYPART_LABELS[moment.key] ?? moment.key}</span>
                  <b>{moment.entries}</b>
                  <span className="muted small">
                    {moment.topEmotion
                      ? `${moment.topEmotion.name}${moment.averageIntensity !== null ? ` · ${moment.averageIntensity}/10` : ''}`
                      : 'Sin registros'}
                  </span>
                </div>
              ))}
            </div>

            <div className="heatmap" role="img" aria-label="Mapa de calor de día de la semana por franja del día">
              <span className="heatmap-corner" aria-hidden />
              {WEEKDAY_ORDER.map((weekday) => (
                <span className="heatmap-head" key={weekday}>
                  {WEEKDAY_LABELS[weekday]}
                </span>
              ))}
              {DAYPART_ORDER.map((daypart) => (
                <Fragment key={daypart}>
                  <span className="heatmap-rowlabel">{DAYPART_LABELS[daypart]}</span>
                  {WEEKDAY_ORDER.map((weekday) => {
                    const cell = heatmap.find(
                      (item) => item.weekday === weekday && item.daypart === daypart,
                    );
                    const entries = cell?.entries ?? 0;
                    const alpha = entries > 0 ? 0.25 + 0.75 * (entries / heatmapMax) : 0;
                    const color = cell?.topEmotion?.colorHex ?? null;
                    return (
                      <span
                        className="heatmap-cell"
                        key={weekday}
                        title={`${WEEKDAY_LABELS[weekday]} · ${DAYPART_LABELS[daypart]}: ${
                          entries === 0
                            ? 'sin registros'
                            : `${entries} ${entries === 1 ? 'registro' : 'registros'}${
                                cell?.topEmotion ? ` · ${cell.topEmotion.name}` : ''
                              }`
                        }`}
                        style={entries > 0 ? { background: hexToRgba(color, alpha) } : undefined}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
            <div className="heatmap-legend">
              <span>Menos registros</span>
              <span>A más registros</span>
            </div>

            {busiestCell ? (
              <div className="insight">
                Sueles registrar más los <b>{WEEKDAY_LABELS[busiestCell.weekday] ?? busiestCell.weekday}</b> por
                la <b>{DAYPART_LABELS[busiestCell.daypart] ?? busiestCell.daypart}</b>
                {busiestCell.topEmotion ? (
                  <>
                    , sobre todo <b>{busiestCell.topEmotion.name}</b>
                  </>
                ) : null}
                .
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Mis registros */}
        <div className="card chart-card">
          <div className="chart-head">
            <div className="mood-section-title">
              <span className="mood-section-icon">
                <Icon name="book" />
              </span>
              <div>
                <h2>Mis registros</h2>
                <p>Lo más reciente de tu diario emocional.</p>
              </div>
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
            <div className="auth-error" role="alert" style={{ marginTop: 14 }}>
              {logsError}
              <button className="text-link" type="button" onClick={() => void loadRecentLogs()} style={{ marginLeft: 8 }}>
                Reintentar
              </button>
            </div>
          ) : null}

          {!logsError && visibleLogs.length === 0 ? (
            emotionFilter !== 'ALL' && logs.length > 0 ? (
              <p className="muted small" style={{ marginTop: 14 }}>
                No hay registros de «{emotionFilter}» entre los cargados. Carga más o elige otra emoción.
              </p>
            ) : (
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
            )
          ) : null}

          {visibleLogs.length > 0 ? (
            <div className="log-list">
              {visibleLogs.map((log) => (
                <div className="log-row" key={log.id}>
                  <span
                    className="log-emoji"
                    style={{ background: tint(log.emotion.colorHex, '#f0ecff') }}
                    aria-hidden
                  >
                    {moodEmoji(log.emotion.name)}
                  </span>
                  <div className="log-main">
                    <div className="log-head">
                      <b>{log.emotion.name}</b>
                      <span className="log-intensity">{log.intensity}/10</span>
                    </div>
                    {log.contextNote ? <p className="log-note">{log.contextNote}</p> : null}
                    <time className="log-time">
                      {formatDayLong(log.loggedAt.slice(0, 10))} · {formatTime(log.loggedAt)}
                    </time>
                  </div>
                  <div className="log-actions">
                    <button type="button" disabled={busyId === log.id} onClick={() => openEdit(log)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busyId === log.id}
                      onClick={() => void removeLog(log)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {nextCursor ? (
            <div className="mood-loadmore">
              <button
                className="btn-outline"
                type="button"
                disabled={loadingMore}
                onClick={() => {
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
              {emotionFilter !== 'ALL' ? (
                <span className="muted small">
                  Filtrado por «{emotionFilter}»: carga más para ver registros antiguos de esa emoción.
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </WyFrame>
  );
}
