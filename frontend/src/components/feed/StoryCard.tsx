import { Story } from '@/lib/feed-data';
import ReactionBar from './ReactionBar';

const TAG_TONE: Record<Story['tags'][number]['tone'], string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  neutral: 'text-on-surface-variant',
};

const AVATAR_TONE: Record<Story['moodTone'], string> = {
  secondary: 'bg-secondary-fixed text-on-secondary-fixed',
  tertiary: 'bg-tertiary-fixed text-tertiary',
};

const MOOD_TONE: Record<Story['moodTone'], string> = {
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
};

export default function StoryCard({ story }: { story: Story }) {
  return (
    <article className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-[0_4px_24px_rgba(70,72,212,0.04)] flex flex-col gap-space-md transition-all hover:shadow-[0_8px_32px_rgba(70,72,212,0.08)]">
      <header className="flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm min-w-0">
          <div
            className={`w-10 h-10 shrink-0 rounded-full font-headline-sm flex items-center justify-center font-bold ${AVATAR_TONE[story.moodTone]}`}
          >
            {story.character.charAt(0)}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-xs">
              <span className="text-headline-sm text-on-surface truncate">{story.character}</span>
              <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-outline-variant" />
              <span className={`text-label-sm font-medium shrink-0 ${MOOD_TONE[story.moodTone]}`}>
                {story.mood}
              </span>
            </div>
            <span className="text-body-sm text-outline truncate">
              {story.timeAgo} • {story.handle}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label={`Opciones del relato de ${story.character}`}
          className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-lg">more_horiz</span>
        </button>
      </header>

      <div className="flex flex-col gap-space-sm text-on-surface text-body-lg leading-relaxed">
        {story.paragraphs.map((paragraph, index) => (
          <p key={index} className={index > 0 ? 'text-on-surface-variant' : undefined}>
            {paragraph}
          </p>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-space-xs">
        {story.tags.map((tag) => (
          <span
            key={tag.label}
            className={`bg-surface-container px-space-sm py-0.5 rounded-full text-label-sm ${TAG_TONE[tag.tone]}`}
          >
            {tag.label}
          </span>
        ))}
      </div>

      <ReactionBar
        storyId={story.id}
        reactions={story.reactions}
        repliesLabel={story.repliesLabel}
      />
    </article>
  );
}
