'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import StageGlyph from './StageGlyph';
import {
  getEmotionalSummary,
  listEmotionalLogs,
  timezoneOffsetMinutes,
  type EmotionalSummary,
} from '@/lib/emotionalMap';
import { getTree, type TreeView } from '@/lib/tree';

interface RightRailProps {
  summaryHidden: boolean;
  onToggleSummary: () => void;
  onMood: () => void;
  /** v58 solo muestra la tarjeta de recomendación en Inicio. */
  showRecommendation?: boolean;
}

/** Colores y emojis de emociones tal como los define v58 (emotionConfig). */
const EMOTION: Record<string, { emoji: string; color: string; soft: string }> = {
  Alegría: { emoji: '😄', color: '#F4B942', soft: '#FFF6D9' },
  Calma: { emoji: '😌', color: '#42B8A8', soft: '#E2F7F3' },
  Esperanza: { emoji: '🌱', color: '#62B878', soft: '#E8F6EC' },
  Neutral: { emoji: '😐', color: '#8B95A7', soft: '#EEF0F4' },
  Tristeza: { emoji: '😔', color: '#5B84C4', soft: '#E7EFFB' },
  Ansiedad: { emoji: '😟', color: '#8B6CCF', soft: '#F0EAFB' },
  Enojo: { emoji: '😠', color: '#E06A5F', soft: '#FCEAE7' },
  Soledad: { emoji: '🫥', color: '#6670A8', soft: '#EAECF5' },
  Cansancio: { emoji: '😴', color: '#B08B68', soft: '#F5EEE7' },
};

interface Recommendation {
  icon: string;
  title: string;
  copy: string;
  cta: string;
  href?: string;
}

/** Misma lógica que recommendationFor() de v58. */
function recommendationFor(name: string | undefined, intensity: number): Recommendation {
  if (name === 'Ansiedad' || name === 'Enojo')
    return { icon: '🌬️', title: 'Calma tu mente', copy: 'Una pausa guiada de un minuto para bajar el ritmo antes de continuar.', cta: 'Comenzar 1 minuto' };
  if (name === 'Tristeza' || name === 'Soledad' || name === 'Cansancio')
    return { icon: '👣', title: 'Un paso posible', copy: 'Elige una acción pequeña y realista para acompañarte hoy.', cta: 'Elegir mi paso' };
  if (name === 'Neutral')
    return { icon: '🧩', title: 'Desenreda lo que sientes', copy: 'Separa lo que ocurrió, lo que necesitas y tu siguiente paso.', cta: 'Desenredar' };
  if (name === 'Alegría' || name === 'Calma' || name === 'Esperanza')
    return { icon: '✉️', title: 'Guarda este momento', copy: 'Conserva lo que hoy te hizo bien para volver a leerlo en el futuro.', cta: 'Crear cápsula', href: '/mis-capsulas' };
  return intensity >= 7
    ? { icon: '🌬️', title: 'Calma tu mente', copy: 'Una pausa guiada de un minuto antes de decidir qué hacer.', cta: 'Comenzar 1 minuto' }
    : { icon: '🧩', title: 'Desenreda lo que sientes', copy: 'Ordena este momento en tres pasos privados.', cta: 'Comenzar' };
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Semana de lunes a domingo, con las iniciales que muestra v58. */
function currentWeek() {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  return WEEK_LABELS.map((label, i) => ({
    key: isoDay(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)),
    label,
  }));
}

export default function RightRail({
  summaryHidden,
  onToggleSummary,
  onMood,
  showRecommendation = false,
}: RightRailProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<EmotionalSummary | null>(null);
  const [lastMood, setLastMood] = useState<{ name: string; value: number } | null>(null);
  const [tree, setTree] = useState<TreeView | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [summaryResult, latestResult, treeResult] = await Promise.allSettled([
        getEmotionalSummary({ days: 7, tzOffsetMinutes: timezoneOffsetMinutes() }),
        listEmotionalLogs({ limit: 1 }),
        getTree(),
      ]);

      if (!active) return;

      if (summaryResult.status === 'fulfilled' && summaryResult.value.status === 'ok') {
        setSummary(summaryResult.value.data);
      }

      if (latestResult.status === 'fulfilled' && latestResult.value.status === 'ok') {
        const latest = latestResult.value.data.items[0];
        if (latest) setLastMood({ name: latest.emotion.name, value: latest.intensity });
      }

      if (treeResult.status === 'fulfilled') {
        setTree(treeResult.value);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const byDay = new Map((summary?.days ?? []).map((day) => [day.date.slice(0, 10), day]));
  const weekly = currentWeek().map(({ key, label }) => {
    const day = byDay.get(key);
    const value = day?.entries ? Math.round(day.averageIntensity ?? 0) : 0;
    const name = day?.emotion?.name ?? '';
    return {
      key,
      label,
      value,
      color: value ? EMOTION[name]?.color ?? day?.emotion?.colorHex ?? '#E5E7EB' : '#E5E7EB',
      title: value ? `${name} ${value}/10` : 'Sin registro',
    };
  });

  const topName = summary?.emotions[0]?.name ?? 'Esperanza';
  const recommendation = recommendationFor(lastMood?.name, lastMood?.value ?? 5);
  const recColors = EMOTION[lastMood?.name ?? ''] ?? EMOTION.Esperanza;
  const nextDrops = tree?.stage.nextDrops ?? null;
  const drops = (n: number) => `${n} ${n === 1 ? 'gota' : 'gotas'}`;
  const treeCopy =
    tree && nextDrops !== null
      ? `${drops(tree.totalDrops)} en total · ${drops(nextDrops)} para ${tree.stage.nextLabel ?? 'seguir creciendo'}`
      : 'Crece con cada registro que haces.';

  return (
    <>
      <div className="right-card card">
        <div className="summary-title">
          <h3>Resumen de tu semana</h3>
          <button
            className="summary-toggle"
            type="button"
            onClick={onToggleSummary}
            aria-label={summaryHidden ? 'Mostrar resumen' : 'Ocultar resumen'}
          >
            <Icon name={summaryHidden ? 'eye' : 'lock'} />
          </button>
        </div>

        {summaryHidden ? (
          <div className="summary-hidden">
            <span>
              <Icon name="lock" />
            </span>
            <p>Tu resumen está oculto.</p>
            <button className="text-link" type="button" onClick={onToggleSummary}>
              Mostrar resumen
            </button>
          </div>
        ) : (
          <>
            <div className="weekly-mini emotion-bars">
              {weekly.map((day) => (
                <span
                  key={day.key}
                  style={{ height: `${day.value ? day.value * 8 : 2}%`, ['--bar' as string]: day.color }}
                  data-day={day.label}
                  title={day.title}
                />
              ))}
            </div>
            <div className="mini-summary">
              {summary && summary.totalEntries > 0 ? (
                <>
                  <b>
                    Emoción frecuente: {topName} {EMOTION[topName]?.emoji ?? '🌱'}
                  </b>
                  <br />
                  {summary.totalEntries} registros esta semana
                </>
              ) : (
                'Aún no hay registros esta semana.'
              )}
            </div>
            <div className="private-line">
              <Icon name="lock" /> Solo tú puedes verlo
            </div>
            <button className="text-link" type="button" onClick={onMood}>
              Ver mis emociones
            </button>
          </>
        )}
      </div>

      {showRecommendation ? (
        <section
          className="recommended-card compact card"
          style={{ ['--rec' as string]: recColors.color, ['--rec-soft' as string]: recColors.soft }}
        >
          <div className="recommended-icon" aria-hidden="true">
            {recommendation.icon}
          </div>
          <div className="recommended-copy">
            <span className="micro-label">
              {lastMood ? 'RECOMENDADO SEGÚN TU ÚLTIMO REGISTRO' : 'RECOMENDADO PARA HOY'}
            </span>
            <h3>{recommendation.title}</h3>
            <p>{recommendation.copy}</p>
            {lastMood ? (
              <small>
                {EMOTION[lastMood.name]?.emoji ?? '🌱'} {lastMood.name} · {lastMood.value}/10
              </small>
            ) : null}
          </div>
          <button
            className="secondary"
            type="button"
            onClick={() => (recommendation.href ? router.push(recommendation.href) : onMood())}
          >
            {recommendation.cta}
          </button>
        </section>
      ) : null}

      <div className="right-card card tree-mini">
        <div className="summary-title">
          <h3>Mi árbol</h3>
          <button className="guide-btn" type="button" onClick={() => router.push('/mi-arbol')}>
            <Icon name="help" />
            <span>Guía</span>
          </button>
        </div>
        <div className="tree-mini-row">
          <span className="mini-tree">
            <StageGlyph stage={tree?.stage.index ?? 0} />
          </span>
          <div className="tree-mini-copy">
            <b>{tree?.stage.label ?? 'Semilla'}</b>
            <small>{treeCopy}</small>
          </div>
        </div>
        <button className="secondary" type="button" onClick={() => router.push('/mi-arbol')}>
          Ver mi crecimiento
        </button>
      </div>

      <div className="right-card card prompt-card">
        <span className="micro-label">TEMA PARA CONVERSAR</span>
        <h3>Una conversación que suma</h3>
        <p>¿Qué pequeño gesto te hizo sentir acompañado esta semana?</p>
        <button className="secondary" type="button" onClick={() => router.push('/mis-relatos?compose=1')}>
          Responder en privado o publicar
        </button>
      </div>
    </>
  );
}
