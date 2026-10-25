'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import type { IconName } from './icons';
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
}

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function dayLabel(value: string, index: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DAYS[index] ?? '';
  return DAYS[(date.getDay() + 6) % 7];
}
const WEEK: { value: number; color: string }[] = DAYS.map(() => ({
  value: 0,
  color: '#dfe1e8',
}));

const EMOJI: Record<string, string> = {
  Calma: '😌',
  Ansiedad: '😰',
  Neutral: '😐',
  Tristeza: '😢',
  Esperanza: '🌱',
};

interface Recommendation {
  icon: IconName;
  title: string;
  copy: string;
  cta: string;
}

const DEFAULT_RECOMMENDATION: Recommendation = {
  icon: 'sparkle',
  title: 'Un momento para ti',
  copy: 'Elige una práctica breve para acompañar lo que sientes hoy.',
  cta: 'Abrir Mi espacio',
};

const RECOMMENDATIONS: Record<string, Recommendation> = {
  Calma: {
    icon: 'sparkle',
    title: 'Guarda esta calma',
    copy: 'Registra qué te ayudó a llegar aquí para poder volver a ello.',
    cta: 'Registrar estado',
  },
  Ansiedad: {
    icon: 'pulse',
    title: 'Respira conmigo',
    copy: 'Dos minutos para bajar el ritmo y volver al momento presente.',
    cta: 'Empezar pausa',
  },
  Neutral: {
    icon: 'pulse',
    title: 'Escucha lo que necesitas',
    copy: 'Una pausa corta para poner nombre a lo que aparece hoy.',
    cta: 'Abrir Mi espacio',
  },
  Tristeza: {
    icon: 'heart',
    title: 'Un espacio para ti',
    copy: 'Una actividad suave para acompañar la tristeza sin exigirte.',
    cta: 'Abrir Mi espacio',
  },
  Esperanza: {
    icon: 'sparkle',
    title: 'Cuida lo que está creciendo',
    copy: 'Anota el pequeño paso que te dio un poco de luz esta semana.',
    cta: 'Registrar estado',
  },
};

function BonsaiMark() {
  return (
    <svg className="bonsai-mark" viewBox="0 0 64 64" role="img" aria-label="Bonsái">
      <path className="mark-pot" d="M14 47h36l-4 13H18Z" />
      <path className="mark-trunk" d="M31 48c2-11-1-17 2-25m0 16c6-5 8-9 12-13m-14 4c-5-4-7-7-11-9" />
      <g className="mark-crown">
        <circle cx="18" cy="21" r="10" />
        <circle cx="30" cy="15" r="12" />
        <circle cx="43" cy="20" r="11" />
        <circle cx="27" cy="27" r="12" />
        <circle cx="42" cy="29" r="10" />
      </g>
    </svg>
  );
}

export default function RightRail({
  summaryHidden,
  onToggleSummary,
  onMood,
}: RightRailProps) {
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

  const weekly = summary?.days.length
    ? summary.days.slice(-7).map((day, index) => ({
        label: dayLabel(day.date, index),
        value: day.averageIntensity ?? 0,
        color: day.emotion?.colorHex ?? '#dfe1e8',
      }))
    : WEEK.map((day, index) => ({ ...day, label: DAYS[index] }));

  const topEmotion = summary?.emotions[0];
  const topName = topEmotion?.name ?? 'Esperanza';
  const recommendation = (lastMood && RECOMMENDATIONS[lastMood.name]) || DEFAULT_RECOMMENDATION;
  const nextDrops = tree?.stage.nextDrops ?? null;
  const progress = Math.round((tree?.stage.progress ?? 0) * 100);
  const treeCopy =
    tree && nextDrops !== null
      ? `${tree.totalDrops} de ${nextDrops} gotas para ${tree.stage.nextLabel ?? 'seguir creciendo'}`
      : 'Crece con cada registro que haces.';

  return (
    <>
      <div className="right-card card">
        <div className="summary-title">
          <h3>Resumen de tu semana</h3>
          <button
            className="summary-toggle privacy-tip"
            type="button"
            onClick={onToggleSummary}
            aria-label={summaryHidden ? 'Mostrar resumen' : 'Ocultar resumen'}
            data-tooltip="Solo tú puedes verlo"
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
                  key={day.label}
                  style={{
                    height: `${day.value ? Math.max(8, day.value * 8.5) : 4}%`,
                    background: day.color,
                  }}
                  data-day={day.label}
                />
              ))}
            </div>
            <div className="mini-summary">
              <b>
                Emoción frecuente: {topName} {EMOJI[topName] ?? '🌱'}
              </b>
              <br />
              {summary
                ? `${summary.totalEntries} ${summary.totalEntries === 1 ? 'registro' : 'registros'} esta semana.`
                : 'Aún no hay registros esta semana.'}
            </div>
            <button className="text-link" type="button" onClick={onMood}>
              Ver todas mis gráficas
            </button>
          </>
        )}
      </div>

      <section className="right-card card recommended-card compact">
        <div className="recommended-icon">
          <Icon name={recommendation.icon} />
        </div>
        <div className="recommended-copy">
          <span className="micro-label">
            {lastMood ? 'RECOMENDADO SEGÚN TU ÚLTIMO REGISTRO' : 'RECOMENDADO PARA HOY'}
          </span>
          <h3>{recommendation.title}</h3>
          <p>{recommendation.copy}</p>
          {lastMood ? (
            <small>
              {EMOJI[lastMood.name] ?? '🌱'} {lastMood.name} · {lastMood.value}/10
            </small>
          ) : null}
        </div>
        <button className="secondary" type="button" onClick={onMood}>
          {recommendation.cta}
        </button>
      </section>

      <section className="right-card card tree-mini">
        <div className="summary-title">
          <h3>Mi árbol</h3>
          <span className="micro-label">Privado</span>
        </div>
        <div className="tree-mini-row">
          <span className="mini-tree">
            <BonsaiMark />
          </span>
          <div className="tree-mini-copy">
            <b>{tree?.stage.label ?? 'Tu árbol'}</b>
            <small>{treeCopy}</small>
            <div className="mini-progress">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        <Link className="secondary" href="/mi-arbol">
          Ver mi crecimiento
        </Link>
      </section>

      <div className="right-card card prompt-card">
        <span className="micro-label">TEMA PARA CONVERSAR</span>
        <h3>Una conversación que suma</h3>
        <p>¿Qué pequeño gesto te hizo sentir acompañado esta semana?</p>
        <Link className="secondary" href="/mis-relatos?compose=1">
          Responder en privado o publicar
        </Link>
      </div>
    </>
  );
}
