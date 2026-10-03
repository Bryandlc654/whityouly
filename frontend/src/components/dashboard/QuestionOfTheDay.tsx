'use client';

import { useState } from 'react';
import { QUESTION_RESPONSES } from '@/lib/dashboard-data';

export default function QuestionOfTheDay() {
  const [answered, setAnswered] = useState(false);

  return (
    <section className="bg-gradient-to-br from-tertiary-fixed/40 via-surface-container-lowest to-secondary-fixed/30 rounded-2xl p-space-lg shadow-[0_4px_24px_rgba(70,72,212,0.05)] flex flex-col gap-space-sm relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <span className="text-label-sm font-bold text-tertiary uppercase tracking-wider flex items-center gap-1">
          <span className="material-symbols-outlined text-base">psychology_alt</span>
          Pausa compartida • Pregunta del día
        </span>
        <span className="text-body-sm text-on-surface-variant">
          {QUESTION_RESPONSES} personas respondieron hoy
        </span>
      </div>

      <h3 className="text-headline-lg text-on-surface leading-snug">
        ¿Qué pequeño detalle, por diminuto que parezca, te devolvió la paz durante esta semana?
      </h3>
      <p className="text-body-md text-on-surface-variant">
        A veces es el olor a café fresco, una canción olvidada en la radio, o el viento que entra por
        la ventana. Cuéntanos tu micro-momento de luz.
      </p>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-md pt-space-xs">
        <div className="flex items-center -space-x-2">
          {['M', 'S', 'V'].map((letter, index) => {
            const tones = [
              'bg-primary-fixed text-primary',
              'bg-secondary-fixed text-secondary',
              'bg-tertiary-fixed text-tertiary',
            ];
            return (
              <div
                key={letter}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-surface-container-lowest ${tones[index]}`}
              >
                {letter}
              </div>
            );
          })}
          <div className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold flex items-center justify-center ring-2 ring-surface-container-lowest">
            +84
          </div>
          <span className="text-body-sm text-on-surface-variant pl-space-md hidden md:inline">
            Leyendo en comunión
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAnswered((value) => !value)}
          aria-pressed={answered}
          className={
            answered
              ? 'bg-tertiary-container text-on-tertiary-container font-label-lg text-label-lg px-space-md py-2 rounded-full transition-all shadow-md flex items-center justify-center gap-1.5'
              : 'bg-tertiary text-on-tertiary hover:bg-tertiary-container font-label-lg text-label-lg px-space-md py-2 rounded-full transition-all shadow-md flex items-center justify-center gap-1.5'
          }
        >
          <span className="material-symbols-outlined text-sm">
            {answered ? 'favorite' : 'chevron_left'}
          </span>
          <span>{answered ? 'Respuesta guardada' : 'Responder con ternura'}</span>
        </button>
      </div>
    </section>
  );
}
