'use client';

import { useState } from 'react';
import { StoryReaction } from '@/lib/feed-data';

const TONE_TEXT: Record<StoryReaction['tone'], string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
};

interface ReactionBarProps {
  storyId: string;
  reactions: StoryReaction[];
  repliesLabel: string;
}

export default function ReactionBar({ storyId, reactions, repliesLabel }: ReactionBarProps) {
  const [given, setGiven] = useState<Record<string, boolean>>({});

  const toggle = (index: number) => {
    setGiven((current) => ({ ...current, [`${storyId}-${index}`]: !current[`${storyId}-${index}`] }));
  };

  return (
    <footer className="pt-space-xs flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-low/50 -mx-space-lg -mb-space-lg p-space-md rounded-b-2xl">
      <div className="flex flex-wrap items-center gap-1.5">
        {reactions.map((reaction, index) => {
          const active = given[`${storyId}-${index}`] ?? false;
          return (
            <button
              key={reaction.label}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(index)}
              className={[
                'flex items-center gap-1.5 px-space-sm py-1.5 rounded-full transition-all text-label-md shadow-sm',
                active
                  ? 'bg-surface-container-high scale-[1.03]'
                  : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-high',
              ].join(' ')}
            >
              <span>{reaction.emoji}</span>
              <span>{reaction.label}</span>
              <span className={`font-semibold ${TONE_TEXT[reaction.tone]}`}>
                {reaction.count + (active ? 1 : 0)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-space-xs">
        <a
          href="#"
          className="flex items-center gap-1 text-on-surface-variant hover:text-primary text-label-md px-space-sm py-1 rounded-full hover:bg-surface-container-lowest transition-colors"
        >
          <span className="material-symbols-outlined text-base">forum</span>
          <span>{repliesLabel}</span>
        </a>
        <button
          type="button"
          aria-label="Guardar con cariño"
          className="text-outline hover:text-tertiary p-1.5 rounded-full hover:bg-surface-container-lowest transition-colors"
        >
          <span className="material-symbols-outlined text-base">bookmark_heart</span>
        </button>
      </div>
    </footer>
  );
}
