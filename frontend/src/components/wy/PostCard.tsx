'use client';

import { useState } from 'react';
import Avatar from './Avatar';
import Icon from './Icon';
import type { DemoStory } from './feedData';

interface PostCardProps {
  story: DemoStory;
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
  mediaUrl,
  audioUrl,
  supportCount,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="post card">
      <div className="post-head">
        <Avatar initials={story.initials} />
        <div>
          <div className="post-author">
            <span
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
              <button type="button" onClick={onFollowAuthor}>
                {followingAuthor ? 'Siguiendo' : '+ Seguir autor'}
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
          <p className={`post-text ${expanded ? '' : 'clamp'}`}>{story.text}</p>
          {!expanded && (
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
          <Icon name="heart" /> Estoy contigo
        </button>
        <button type="button" onClick={onComment}>
          <Icon name="message" /> Comentar
        </button>
        <button className={followingStory ? 'on' : undefined} type="button" onClick={onFollowStory}>
          <Icon name="bell" /> {followingStory ? 'Siguiendo' : 'Seguir relato'}
        </button>
        <button className={saved ? 'on' : undefined} type="button" onClick={onSave}>
          <Icon name="bookmark" /> Guardar
        </button>
      </div>
    </article>
  );
}
