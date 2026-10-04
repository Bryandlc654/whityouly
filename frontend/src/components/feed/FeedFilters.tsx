'use client';

import { useState } from 'react';
import { FEED_FILTERS } from '@/lib/feed-data';

export default function FeedFilters() {
  const [active, setActive] = useState<(typeof FEED_FILTERS)[number]>(FEED_FILTERS[0]);

  return (
    <div className="flex items-center justify-between gap-space-sm pt-space-xs overflow-x-auto pb-1">
      <div className="flex items-center gap-space-xs shrink-0" role="tablist" aria-label="Filtros del feed">
        {FEED_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={active === filter}
            onClick={() => setActive(filter)}
            className={
              active === filter
                ? 'bg-primary text-on-primary text-label-lg px-space-md py-1.5 rounded-full shadow-sm flex items-center gap-1.5 whitespace-nowrap'
                : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-label-lg px-space-md py-1.5 rounded-full transition-colors whitespace-nowrap'
            }
          >
            {active === filter && <span className="material-symbols-outlined text-sm">favorite</span>}
            {filter}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="text-on-surface-variant hover:text-on-surface flex items-center gap-1 text-label-sm shrink-0 ml-space-sm"
      >
        <span className="material-symbols-outlined text-sm">filter_list</span>
        <span>Ritmo: Calmo</span>
      </button>
    </div>
  );
}
