'use client';

import { useState } from 'react';
import { MOODS } from '@/lib/dashboard-data';

export default function MoodSelector() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-space-md shadow-[0_4px_20px_rgba(70,72,212,0.03)] flex flex-col gap-space-sm">
      <div className="flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-secondary text-lg">spa</span>
          <span className="text-headline-sm text-on-surface">¿Cómo late tu corazón hoy?</span>
        </div>
        <span className="hidden sm:inline text-label-sm text-outline">Registro confidencial</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-space-xs pt-1">
        {MOODS.map((mood) => {
          const isSelected = selected === mood.id;
          return (
            <button
              key={mood.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(isSelected ? null : mood.id)}
              className={[
                'flex items-center justify-center gap-1.5 py-2 px-space-xs rounded-xl transition-all text-center',
                'wide' in mood && mood.wide ? 'col-span-2 sm:col-span-1' : '',
                isSelected
                  ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                  : `bg-surface-container-low text-on-surface hover:bg-surface-container-high ${mood.hover}`,
              ].join(' ')}
            >
              <span className="text-base">{mood.emoji}</span>
              <span className="text-label-md">{mood.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-space-xs pt-1">
        <span className="text-body-sm text-on-surface-variant flex items-center gap-1">
          <span className="material-symbols-outlined text-sm text-secondary">visibility_off</span>
          Solo visible para tu histórico personal
        </span>
        <a href="#" className="text-label-sm text-primary hover:underline font-semibold">
          Guardar en mi Mapa →
        </a>
      </div>
    </section>
  );
}
