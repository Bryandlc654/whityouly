import type { CSSProperties } from 'react';
import { decodeVisualCard, patternImage, type VisualCardTheme } from '@/lib/visualCards';

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
  // Tema predefinido (clase CSS) o degradado propio (variables en línea), con patrón opcional.
  const style = decodeVisualCard(theme);
  const inline: CSSProperties | undefined =
    style && !style.preset
      ? ({ '--card-a': style.from, '--card-b': style.to, color: style.ink } as CSSProperties)
      : undefined;
  const pattern = style ? patternImage(style.pattern, style.ink) : undefined;
  const lightInk = style ? style.ink !== '#ffffff' : false;

  return (
    <article
      className={`visual-story-card${style?.preset ? ` theme-${style.preset}` : ' theme-custom'}${
        lightInk ? ' is-light' : ''
      }${mediaUrl ? ' has-media' : ''}${compact ? ' is-compact' : ''}${preview ? ' is-preview' : ''}`}
      style={inline}
    >
      {mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl} alt="" className="visual-story-card-media" />
      ) : null}
      {pattern && !mediaUrl ? (
        <span className="visual-story-card-pattern" style={{ backgroundImage: pattern }} aria-hidden />
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
