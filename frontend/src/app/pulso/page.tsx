'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import Icon from '@/components/wy/Icon';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import { getCommunityPulse, type CommunityPulse, type PulseEmotion } from '@/lib/community';

const RANGES: { id: number; label: string }[] = [
  { id: 7, label: '7 días' },
  { id: 14, label: '14 días' },
  { id: 30, label: '30 días' },
];

const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
};

const DAYPART_LABELS: Record<string, string> = {
  madrugada: 'Madrugada',
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
};

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function shortDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric' }).format(date);
}

function emotionColor(emotion: PulseEmotion | null | undefined): string {
  return emotion?.colorHex ?? 'var(--purple)';
}

export default function PulsoPage() {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState<CommunityPulse | null>(null);
  const [error, setError] = useState('');
  const [range, setRange] = useState<number>(7);

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? '' : current)), 2400);
  }, []);

  const loadPulse = useCallback(async (days: number) => {
    setError('');
    const result = await getCommunityPulse({
      days,
      tzOffsetMinutes: new Date().getTimezoneOffset(),
    }).then(
      (data) => ({ status: 'ok' as const, data }),
      (err: unknown) => ({
        status: 'error' as const,
        message: err instanceof Error ? err.message : 'No se pudo cargar el pulso comunitario.',
      }),
    );

    if (result.status === 'ok') {
      setPulse(result.data);
      return;
    }
    setError(result.message);
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
      } catch {
        /* el pulso se intentará cargar igualmente */
      } finally {
        setLoading(false);
      }
    };
    void verify();
  }, [router]);

  useEffect(() => {
    if (!loading) void loadPulse(range);
  }, [loading, range, loadPulse]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Ir al Feed', icon: 'home', onClick: () => router.push('/feed') },
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
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
      case 'following':
        router.push('/siguiendo');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'mood':
        router.push('/mi-estado');
        break;
      case 'pulso':
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const suppressed = pulse?.privacy.suppressed ?? false;
  const maxEntries = pulse ? Math.max(1, ...pulse.days.map((day) => day.entries)) : 1;
  const topEmotionCount = pulse?.emotions[0]?.count ?? 1;

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="pulso"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={false}
          onToggleSummary={() => notify('El pulso se muestra siempre agregado y anónimo.')}
          onDaily={() => notify('La consigna diaria llega con el módulo de historias.')}
          onCategory={(category) => notify(`Explorar “${category}” llega pronto.`)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen">
        <div className="card mood-hero">
          <div>
            <h1>Pulso comunitario</h1>
            <p>
              {loading
                ? 'Cargando el pulso de la comunidad…'
                : 'Cómo se siente la comunidad en conjunto. Datos siempre agregados y anónimos.'}
            </p>
          </div>
          <span className="privacy-badge">
            <Icon name="lock" /> Anónimo
          </span>
        </div>

        <div className="card chart-card">
          <div className="chart-head">
            <div>
              <h2>Estado emocional de la comunidad</h2>
              <p>
                {pulse
                  ? `${pulse.privacy.participants} personas distintas en los últimos ${pulse.range.days} días.`
                  : 'Resumen de las emociones compartidas por la comunidad.'}
              </p>
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

          {error ? (
            <div className="auth-error" role="alert" style={{ marginTop: 12 }}>
              {error}
              <button
                className="text-link"
                type="button"
                onClick={() => void loadPulse(range)}
                style={{ marginLeft: 8 }}
              >
                Reintentar
              </button>
            </div>
          ) : null}

          {loading && !pulse ? (
            <p className="muted small" style={{ marginTop: 16 }}>
              Cargando el pulso de la comunidad…
            </p>
          ) : null}

          {!loading && pulse && suppressed ? (
            <div className="insight" style={{ marginTop: 16 }}>
              <b>Aún no hay suficiente comunidad.</b> Para proteger la identidad de cada persona,
              solo mostramos el pulso cuando participan al menos <b>{pulse.privacy.minUsers}</b>{' '}
              personas distintas. Vuelve a intentarlo más tarde.
            </div>
          ) : null}

          {!loading && pulse && !suppressed ? (
            <>
              <div className="rank" aria-label="Emociones más frecuentes">
                {pulse.emotions.slice(0, 6).map((emotion) => {
                  const width = Math.round((emotion.count / topEmotionCount) * 100);
                  const color = emotionColor(emotion);
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
                        {emotion.participants} pers. · {Math.round(emotion.share * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {pulse.dominantEmotion ? (
                <div className="insight">
                  <b>{pulse.dominantEmotion.name}</b> es la emoción más compartida del periodo
                  {pulse.averageIntensity !== null ? (
                    <> con una intensidad media de <b>{pulse.averageIntensity.toFixed(2)}/5</b></>
                  ) : null}
                  .
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {!loading && pulse && !suppressed && pulse.days.length > 0 ? (
          <div className="card chart-card">
            <div className="chart-head">
              <div>
                <h2>Cómo cambia por día</h2>
                <p>La altura refleja cuántos registros hubo ese día. En gris, días sin participación suficiente.</p>
              </div>
            </div>

            <div className="bar-chart">
              {pulse.days.map((day) => (
                <div
                  className="bar-col"
                  key={day.date}
                  title={day.suppressed ? 'Datos insuficientes' : `${day.entries} registros`}
                >
                  <i
                    style={
                      {
                        '--h': `${day.suppressed ? 4 : Math.max(6, (day.entries / maxEntries) * 100)}%`,
                        background: day.suppressed
                          ? '#d9d6e6'
                          : `linear-gradient(${emotionColor(day.emotion)}, ${emotionColor(day.emotion)}cc)`,
                      } as CSSProperties
                    }
                  />
                  <small>{shortDay(day.date)}</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && pulse && !suppressed ? (
          <div className="card chart-card">
            <div className="chart-head">
              <div>
                <h2>Momentos de la semana</h2>
                <p>La emoción más compartida por día de la semana y por franja horaria.</p>
              </div>
            </div>

            <div className="moment-grid">
              {pulse.weekdays.map((bucket) => (
                <div
                  className="moment-col"
                  key={bucket.key}
                  title={bucket.suppressed ? 'Datos insuficientes' : `${bucket.entries} registros`}
                >
                  <i
                    style={
                      {
                        '--h': `${bucket.suppressed ? 4 : Math.max(6, (bucket.entries / maxEntries) * 100)}%`,
                        background: bucket.suppressed
                          ? '#d9d6e6'
                          : `linear-gradient(${emotionColor(bucket.topEmotion)}, ${emotionColor(bucket.topEmotion)}cc)`,
                      } as CSSProperties
                    }
                  />
                  <small>{WEEKDAY_LABELS[bucket.key] ?? bucket.key}</small>
                </div>
              ))}
            </div>

            <div className="rank" aria-label="Franjas horarias">
              {pulse.dayparts.map((bucket) => (
                <div className="rank-row" key={bucket.key}>
                  <span className="rank-name">{DAYPART_LABELS[bucket.key] ?? bucket.key}</span>
                  <span className="rank-bar">
                    <b
                      style={{
                        width: `${bucket.suppressed ? 0 : Math.round((bucket.entries / maxEntries) * 100)}%`,
                        background: emotionColor(bucket.topEmotion),
                      }}
                    />
                  </span>
                  <span className="rank-value">
                    {bucket.suppressed ? '—' : (bucket.topEmotion?.name ?? 'Sin datos')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && pulse ? (
          <div className="card chart-card">
            <div className="chart-head">
              <div>
                <h2>Privacidad</h2>
                <p>Tu diario sigue siendo privado: aquí solo ves agregados del conjunto.</p>
              </div>
            </div>
            <div className="insight">
              {pulse.privacy.note ||
                `Los datos se muestran siempre agregados y anónimos. Solo se publican los grupos con al menos ${pulse.privacy.minUsers} personas distintas.`}
            </div>
          </div>
        ) : null}
      </section>
    </WyFrame>
  );
}
