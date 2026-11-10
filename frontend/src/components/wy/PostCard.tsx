'use client';

import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import Icon from './Icon';
import VisualStoryCard from './VisualStoryCard';
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
  onOpenStory: () => void;
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
  onOpenStory,
  onShare,
  mediaUrl,
  audioUrl,
  supportCount,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [translated, setTranslated] = useState(false);
  const [warningRevealed, setWarningRevealed] = useState(!story.contentWarning);
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
  }, [expanded, story.text, translated]);

  const visibleTitle = translated && story.translation ? story.translation.title : story.title;
  const visibleText = translated && story.translation ? story.translation.content : story.text;

  return (
    <article className={`post card${story.contentWarning && !warningRevealed ? ' sensitive-locked' : ''}`}>
      <div className="post-head">
        <Avatar initials={story.initials} />
        <div>
          <div className="post-author">
            <button className="author-name" type="button" onClick={onAuthor}>
              {story.author}
            </button>
            {isOwn ? (
              statusLabel !== 'PUBLISHED' ? <span className="tag update">Borrador</span> : null
            ) : (
              <button
                type="button"
                aria-pressed={followingAuthor}
                title="Ver sus nuevos relatos en Siguiendo"
                onClick={onFollowAuthor}
              >
                {followingAuthor ? 'Siguiendo' : '+ Seguir autor'}
              </button>
            )}
          </div>
          <div className="post-time">{story.time}</div>
        </div>
        <button className="more-btn" type="button" onClick={onOpenMenu} aria-label="Más opciones del relato">
          <Icon name="more" />
        </button>
      </div>

      <div className="post-tags">
        <span className="tag">{story.category}</span>
        {story.updateKind && story.updateKind !== 'Relato' ? (
          <span className="tag update">{story.updateKind}</span>
        ) : null}
        {story.translation ? (
          <button className="tag translation-toggle" type="button" onClick={() => setTranslated((value) => !value)}>
            {translated ? 'Ver original' : 'Ver traducción'}
          </button>
        ) : null}
        {followingStory ? <span className="tag hope">Siguiendo relato</span> : null}
      </div>

      {story.contentWarning && !warningRevealed ? (
        <div className="content-warning-gate">
          <span className="content-warning-icon"><Icon name="shield" /></span>
          <div>
            <b>Aviso de contenido</b>
            <p>{story.contentWarning}</p>
            <button className="secondary" type="button" onClick={() => setWarningRevealed(true)}>
              Ver contenido
            </button>
          </div>
        </div>
      ) : null}

      <div className="post-body">
      {story.contentWarning ? (
        <div className="content-warning">
          <Icon name="shield" />
          <span>
            <b>Aviso de contenido</b>
            {story.contentWarning}
          </span>
        </div>
      ) : null}

      {story.visualCardTheme ? (
        <>
          <VisualStoryCard
            theme={story.visualCardTheme}
            title={visibleTitle}
            text={visibleText}
            mediaUrl={mediaUrl}
            category={story.category}
            author={story.author}
            compact
          />
          <button className="post-more" type="button" onClick={onComment}>
            Abrir relato completo
          </button>
        </>
      ) : (
        <>
          <h2>{visibleTitle}</h2>
          {story.text ? (
            <>
              <p ref={textRef} className={`post-text ${expanded ? '' : 'clamp'}`}>
                {visibleText}
              </p>
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
        </>
      )}
      {story.stageCount && story.stageCount > 1 && !story.visualCardTheme ? (
        <button className="post-more" type="button" onClick={onOpenStory}>
          Ver historia completa ({story.stageCount} partes)
        </button>
      ) : null}
      {audioUrl ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={audioUrl} className="post-audio" />
      ) : null}
      {story.transcript ? (
        <details className="story-transcript">
          <summary>Ver transcripción del audio</summary>
          <p>{story.transcript}</p>
        </details>
      ) : null}

      {story.musicLabel || story.music ? (
        <div className="music-chip">
          <button className="play" type="button" onClick={onPlay} aria-label="Reproducir fragmento">
            <Icon name="play" />
          </button>
          <div>
            <b>{story.musicLabel ?? story.music}</b>
            <small>Canción vinculada por el autor · Vista previa</small>
          </div>
        </div>
      ) : null}
      </div>

      {(() => {
        const support = supportCount ?? story.support + (supported ? 1 : 0);
        return (
          <div className="post-stats" hidden={!support && !story.comments}>
            <span className="support-summary" hidden={!support}>
              <span className="support-heart" aria-hidden="true">
                <Icon name="heart" />
              </span>
              <span>{support} personas están contigo</span>
            </span>
            <button type="button" onClick={onComment} hidden={!story.comments}>
              {story.comments} comentarios
            </button>
          </div>
        );
      })()}

      <div className="post-actions">
        <button
          className={supported ? 'on' : undefined}
          type="button"
          onClick={onSupport}
          aria-pressed={supported}
          aria-label="Estoy contigo"
        >
          <Icon name="heart" />
          <span className="action-label">Estoy contigo</span>
        </button>
        <button type="button" onClick={onComment} aria-label="Comentar">
          <Icon name="message" />
          <span className="action-label">Comentar</span>
        </button>
        {isOwn ? (
          <button className={saved ? 'on' : undefined} type="button" onClick={onSave} aria-label="Guardar relato">
            <Icon name="bookmark" />
            <span className="action-label">Guardar</span>
          </button>
        ) : (
          <button
            className={followingStory ? 'on' : undefined}
            type="button"
            onClick={onFollowStory}
            aria-pressed={followingStory}
            title="Recibir solo las continuaciones de esta historia"
          >
            <Icon name="trend" />
            <span className="action-label">{followingStory ? 'Siguiendo' : 'Seguir relato'}</span>
          </button>
        )}
        <button type="button" onClick={onShare} aria-label="Compartir relato">
          <Icon name="share" />
          <span className="action-label">Compartir</span>
        </button>
      </div>
    </article>
  );
}
