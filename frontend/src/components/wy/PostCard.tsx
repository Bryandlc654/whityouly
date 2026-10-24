'use client';

import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import Icon from './Icon';
import type { FeedStory } from './feedData';

interface PostCardProps {
  story: FeedStory;
  supported: boolean;
  saved: boolean;
  followingAuthor: boolean;
  followingStory: boolean;
  /** Relato propio: no se ofrece "seguir autor" y se marca su estado. */
  isOwn?: boolean;
  statusLabel?: 'DRAFT' | 'PUBLISHED';
  /** Imagen/audio de la apertura, para relatos sin texto. */
  mediaUrl?: string | null;
  audioUrl?: string | null;
  /** Total de acompañamientos exacto (tras una acción propia). */
  supportCount?: number;
  onSupport: () => void;
  onSave: () => void;
  onFollowAuthor: () => void;
  onFollowStory: () => void;
  onOpenMenu: () => void;
  onPlay: () => void;
  onAuthor: () => void;
  onComment: () => void;
  onShare: () => void;
}

export default function PostCard({
  story,
  supported,
  saved,
  followingAuthor,
  followingStory,
  isOwn = false,
  statusLabel,
  onSupport,
  onSave,
  onFollowAuthor,
  onFollowStory,
  onOpenMenu,
  onPlay,
  onAuthor,
  onComment,
  onShare,
  mediaUrl,
  audioUrl,
  supportCount,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [textOverflows, setTextOverflows] = useState(false);

  // "Leer relato completo" solo tiene sentido si el texto no cabe en la vista
  // previa. Se mide el recorte real (no una estimación por caracteres) y se
  // vuelve a comprobar al cambiar el ancho: el número de líneas depende de él.
  useEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;

    const measure = () => setTextOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, story.text]);

  return (
    <article className="post card">
      <div className="post-head">
        <Avatar initials={story.initials} />
        <div>
          <div className="post-author">
            <span
              className="author-name"
              role="button"
              tabIndex={0}
              onClick={onAuthor}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onAuthor();
                }
              }}
            >
              {story.author}
            </span>
            {isOwn ? (
              <span className="tag update" style={{ marginLeft: 8 }}>
                {statusLabel === 'PUBLISHED' ? 'Tu relato · Publicado' : 'Tu relato · Borrador'}
              </span>
            ) : (
              <button
                type="button"
                key={followingAuthor ? 'following' : 'follow'}
                className={`follow-btn${followingAuthor ? ' on' : ''}`}
                aria-pressed={followingAuthor}
                onClick={onFollowAuthor}
              >
                <Icon name={followingAuthor ? 'check' : 'plus'} />
                {followingAuthor ? 'Siguiendo' : 'Seguir autor'}
              </button>
            )}
          </div>
          <div className="post-time">{story.time} · Seudónimo único</div>
        </div>
        <button className="more-btn" type="button" onClick={onOpenMenu} aria-label="Más opciones">
          <Icon name="more" />
        </button>
      </div>

      <div className="post-tags">
        <span className="tag">{story.category}</span>
        <span className="tag update">{story.updateKind}</span>
        {followingStory ? <span className="tag hope">Siguiendo relato</span> : null}
      </div>

      <h2>{story.title}</h2>
      {story.text ? (
        <>
          <p ref={textRef} className={`post-text ${expanded ? '' : 'clamp'}`}>{story.text}</p>
          {!expanded && textOverflows && (
            <button className="post-more" type="button" onClick={() => setExpanded(true)}>
              Leer relato completo
            </button>
          )}
        </>
      ) : null}
      {mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl} alt={story.title} className="post-media" />
      ) : null}
      {audioUrl ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={audioUrl} className="post-audio" />
      ) : null}

      {story.music ? (
        <div className="music-chip">
          <button className="play" type="button" onClick={onPlay} aria-label="Reproducir fragmento">
            <Icon name="play" />
          </button>
          <div>
            <b>{story.music}</b>
            <small>Canción vinculada por el autor · Vista previa</small>
          </div>
        </div>
      ) : null}

      <div className="post-stats">
        <span>{supportCount ?? story.support + (supported ? 1 : 0)} personas están contigo</span>
        <span>{story.comments} comentarios</span>
      </div>

      <div className="post-actions">
        <button className={supported ? 'on' : undefined} type="button" onClick={onSupport}>
          <Icon name="heart" />
          <span className="action-label">Estoy contigo</span>
        </button>
        <button type="button" onClick={onComment}>
          <Icon name="message" />
          <span className="action-label">Comentar</span>
        </button>
        <button className={followingStory ? 'on' : undefined} type="button" onClick={onFollowStory}>
          <Icon name="bell" />
          <span className="action-label">{followingStory ? 'Siguiendo' : 'Seguir relato'}</span>
        </button>
        <button className={saved ? 'on' : undefined} type="button" onClick={onSave}>
          <Icon name="bookmark" />
          <span className="action-label">Guardar</span>
        </button>
        <button type="button" onClick={onShare}>
          <Icon name="share" />
          <span className="action-label">Compartir</span>
        </button>
      </div>
    </article>
  );
}
