import type { VisualCardTheme } from '@/lib/visualCards';

interface Props {
  theme: VisualCardTheme;
  title: string;
  text: string;
  mediaUrl?: string | null;
  category?: string | null;
  author?: string | null;
  compact?: boolean;
  preview?: boolean;
}

export default function VisualStoryCard({
  theme,
  title,
  text,
  mediaUrl,
  category,
  author,
  compact = false,
  preview = false,
}: Props) {
  return (
    <article
      className={`visual-story-card theme-${theme}${mediaUrl ? ' has-media' : ''}${
        compact ? ' is-compact' : ''
      }${preview ? ' is-preview' : ''}`}
    >
      {mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl} alt="" className="visual-story-card-media" />
      ) : null}
      <div className="visual-story-card-scrim" aria-hidden />
      <div className="visual-story-card-content">
        <div className="visual-story-card-top">
          <span className="visual-story-card-brand">Withyouly</span>
          {category ? <span className="visual-story-card-tag">{category}</span> : null}
        </div>
        <div className="visual-story-card-copy">
          <h2>{title}</h2>
          {text ? <p className={compact ? 'clamp' : ''}>{text}</p> : null}
        </div>
        <div className="visual-story-card-footer">
          <span>{author ? `Por ${author}` : 'Relato visual'}</span>
          <span aria-hidden>withyouly</span>
        </div>
      </div>
    </article>
  );
}
