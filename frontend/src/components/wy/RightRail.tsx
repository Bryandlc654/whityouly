'use client';

import Icon from './Icon';
import { DAILY_INTENSITY } from './feedData';

interface RightRailProps {
  summaryHidden: boolean;
  onToggleSummary: () => void;
  onDaily: () => void;
  onCategory: (category: string) => void;
  onMood: () => void;
}

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const CATEGORIES = ['Esperanza', 'Gratitud', 'Soledad', 'Ansiedad', 'Aprendizaje'];

export default function RightRail({
  summaryHidden,
  onToggleSummary,
  onDaily,
  onCategory,
  onMood,
}: RightRailProps) {
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
            <p>Tu resumen está oculto en esta pantalla.</p>
            <button className="text-link" type="button" onClick={onToggleSummary}>
              Mostrar resumen
            </button>
          </div>
        ) : (
          <>
            <div className="weekly-mini">
              {DAILY_INTENSITY.map((value, index) => (
                <span key={DAYS[index]} style={{ height: `${value * 9}%` }} data-day={DAYS[index]} />
              ))}
            </div>
            <div className="side-trend">
              <div>
                <b>Tendencia emocional</b>
                <small>Ánimo general</small>
              </div>
              <svg viewBox="0 0 220 54" preserveAspectRatio="none" aria-label="Tendencia semanal">
                <defs>
                  <linearGradient id="sideArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#7655f4" stopOpacity=".24" />
                    <stop offset="1" stopColor="#7655f4" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M2 39 C25 43 39 48 58 43 S91 20 110 25 S142 42 164 31 S197 15 218 18 L218 54 L2 54Z"
                  fill="url(#sideArea)"
                />
                <path
                  d="M2 39 C25 43 39 48 58 43 S91 20 110 25 S142 42 164 31 S197 15 218 18"
                  fill="none"
                  stroke="#6847f5"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="mini-summary">
              <b style={{ color: 'var(--ink)' }}>Promedio: 7.1/10</b>
              <br />
              Tu estado mostró mayor estabilidad que la semana pasada.
            </div>
            <div className="private-line">
              <Icon name="lock" /> Solo tú puedes verlo
            </div>
            <button className="text-link" type="button" onClick={onMood} style={{ marginTop: 8, paddingLeft: 0 }}>
              Ver todas mis gráficas
            </button>
          </>
        )}
      </div>

      <div className="right-card card prompt-card">
        <h3>Consigna del día</h3>
        <p>¿Qué te gustaría decirte a ti mismo hace un año?</p>
        <button className="secondary" type="button" onClick={onDaily}>
          Responder en privado o publicar
        </button>
      </div>

      <div className="right-card card">
        <h3>Explora por emoción</h3>
        <div className="category-list">
          {CATEGORIES.map((category) => (
            <button key={category} type="button" onClick={() => onCategory(category)}>
              {category}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
