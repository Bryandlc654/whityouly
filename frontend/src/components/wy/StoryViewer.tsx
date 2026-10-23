'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import Avatar from './Avatar';
import CommentSection from './CommentSection';
import { viewStory, type MyStory } from '@/lib/stories';

interface Props {
  storyId?: string;
  /** Si ya viene cargada la historia, no se vuelve a pedir al servidor. */
  story?: MyStory;
  /** Título provisional mientras carga (resumen del feed). */
  title?: string;
  onClose: () => void;
  onNotify?: (message: string) => void;
  /** 'modal' dibuja su propia caja (Feed, Explorar, Siguiendo); 'inline' va dentro de otro contenedor (buscador). */
  variant?: 'modal' | 'inline';
}

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    date,
  );
}

export default function StoryViewer({
  storyId,
  story: initial,
  title,
  onClose,
  onNotify,
  variant = 'modal',
}: Props) {
  const [story, setStory] = useState<MyStory | null>(initial ?? null);
  const [busy, setBusy] = useState(!initial);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial || !storyId) return;
    let active = true;
    setBusy(true);
    setError('');
    void viewStory(storyId).then((result) => {
      if (!active) return;
      setBusy(false);
      if (result.status === 'ok') {
        setStory(result.data);
      } else {
        setError(result.message);
      }
    });
    return () => {
      active = false;
    };
  }, [storyId, initial]);

  const body = (
    <div className="story-reader">
      {error ? (
        <div className="auth-error" role="alert">
          {error}
        </div>
      ) : null}
      {busy ? <p className="hint">Cargando la historia…</p> : null}

      {story ? (
        <>
          {variant === 'inline' ? (
            <div className="story-reader-author">
              <Avatar
                initials={initialsOf(story.author?.name)}
                avatarUrl={story.author?.avatarUrl}
                size="sm"
              />
              <div>
                <b>{story.author?.name ?? 'Autor desconocido'}</b>
                <span className="hint">
                  {story.status === 'WITHDRAWN'
                    ? 'Relato retirado'
                    : `${formatDate(story.updatedAt)} · ${story.updates.length} ${
                        story.updates.length === 1 ? 'etapa' : 'etapas'
                      }`}
                </span>
              </div>
            </div>
          ) : null}

          {story.status === 'WITHDRAWN' ? (
            <div className="withdrawn-story" role="status">
              <span className="withdrawn-story-icon">
                <Icon name="lock" />
              </span>
              <h2>{story.title}</h2>
              <p>
                El autor retiró esta parte de la historia. El texto, la imagen y el audio ya no
                están disponibles.
              </p>
            </div>
          ) : (
            <>
              <div className="story-timeline">
                {story.updates.map((stage, index) => {
                  const last = index === story.updates.length - 1;
                  return (
                    <article key={stage.id} className={`story-stage${last ? ' last' : ''}`}>
                      <span className="story-stage-dot" aria-hidden />
                      <div className="story-stage-head">
                        <span className="story-stage-tag">Etapa {stage.stageOrder}</span>
                        <span className="hint">{formatDate(stage.createdAt)}</span>
                      </div>
                      {stage.content ? <p className="story-stage-text">{stage.content}</p> : null}
                      {stage.mediaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={stage.mediaUrl} alt="" className="post-media" />
                      ) : null}
                      {stage.audioUrl ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <audio controls src={stage.audioUrl} className="post-audio" />
                      ) : null}
                    </article>
                  );
                })}
              </div>

              <div className="story-reader-comments">
                <CommentSection storyId={story.id} onNotify={onNotify} />
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );

  if (variant === 'modal') {
    return (
      <div className="modal story-viewer" role="dialog" aria-modal="true" aria-label="Historia">
        <div className="modal-head">
          <div>
            <h2>{story?.title ?? title ?? 'Historia'}</h2>
            <p>
              {story
                ? story.status === 'WITHDRAWN'
                  ? `${story.author?.name ? `${story.author.name} · ` : ''}Relato retirado`
                  : `${story.author?.name ? `${story.author.name} · ` : ''}${story.updates.length} ${
                      story.updates.length === 1 ? 'etapa' : 'etapas'
                    }`
                : 'Cargando…'}
            </p>
          </div>
          <button className="close" type="button" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" />
          </button>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div className="story-viewer story-viewer-inline" role="dialog" aria-modal="true" aria-label="Historia">
      <div className="story-viewer-inline-head">
        <button className="action-link" type="button" onClick={onClose}>
          <Icon name="chevron" /> Volver a resultados
        </button>
        <span className="hint">
          {story
            ? story.status === 'WITHDRAWN'
              ? 'Relato retirado'
              : `${story.updates.length} etapas`
            : ''}
        </span>
      </div>
      <h2 className="story-viewer-inline-title">{story?.title ?? title ?? 'Historia'}</h2>
      {body}
    </div>
  );
}