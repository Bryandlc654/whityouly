'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import Avatar from './Avatar';
import CommentSection from './CommentSection';
import VisualStoryCard from './VisualStoryCard';
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
  variant?: 'modal' | 'inline' | 'page';
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

/** Lectores abiertos: evita que el «atrás» de un desmontaje cierre el siguiente. */
let openReaders = 0;

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
  const [warningRevealed, setWarningRevealed] = useState(!initial?.contentWarning);
  const [commentUpdateId, setCommentUpdateId] = useState('all');
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    setWarningRevealed(!story?.contentWarning);
  }, [story?.id, story?.contentWarning]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (variant !== 'modal') return;
    const previousOverflow = document.body.style.overflow;
    // Al bloquear el scroll del documento desaparece la barra de desplazamiento
    // y el contenido centrado se desplaza. Reservamos su ancho para que el
    // lector lateral se abra sin saltos ni franjas vacías.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousPaddingRight = document.body.style.paddingRight;
    const marker = 'withyoulyStoryReader';
    const previousState = window.history.state;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    openReaders += 1;
    if (!previousState?.[marker]) {
      window.history.pushState({ ...(previousState ?? {}), [marker]: true }, '');
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    const onPop = () => onCloseRef.current();

    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      openReaders -= 1;
      // En modo estricto React desmonta y vuelve a montar el efecto: se espera un
      // ciclo para no cerrar el lector recién abierto con el «atrás» del primero.
      window.setTimeout(() => {
        if (openReaders === 0 && window.history.state?.[marker]) window.history.back();
      }, 0);
    };
  }, [variant]);

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
    <div className={`story-reader${story?.contentWarning && !warningRevealed ? ' sensitive-locked' : ''}`}>
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

              {story.contentWarning ? (
                <div className="content-warning">
                  <Icon name="shield" />
                  <span>
                    <b>Aviso de contenido</b>
                    {story.contentWarning}
                  </span>
                </div>
              ) : null}
              {story.musicLabel ? (
                <div className="music-chip viewer-music-chip">
                  <Icon name="music" />
                  <div>
                    <b>{story.musicLabel}</b>
                    <small>Canción vinculada por el autor</small>
                  </div>
                </div>
              ) : null}
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
                      {index === 0 && story.visualCardTheme ? (
                        <VisualStoryCard
                          theme={story.visualCardTheme}
                          title={story.title}
                          text={stage.content}
                          mediaUrl={stage.mediaUrl}
                          category={story.categories[0]}
                          author={story.author?.name}
                        />
                      ) : (
                        <>
                          {stage.content ? <p className="story-stage-text">{stage.content}</p> : null}
                          {stage.mediaUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={stage.mediaUrl} alt="" className="post-media" />
                          ) : null}
                        </>
                      )}
                      {stage.audioUrl ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <audio controls src={stage.audioUrl} className="post-audio" />
                      ) : null}
                      {stage.transcript ? (
                        <details className="story-transcript">
                          <summary>Ver transcripción del audio</summary>
                          <p>{stage.transcript}</p>
                        </details>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              <div className="story-reader-comments">
                <label className="comment-scope-select">
                  Comentarios de
                  <select
                    value={commentUpdateId}
                    onChange={(event) => setCommentUpdateId(event.target.value)}
                  >
                    <option value="all">Todo el relato</option>
                    {story.updates.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        Etapa {stage.stageOrder}
                      </option>
                    ))}
                  </select>
                </label>
                <CommentSection
                  key={commentUpdateId}
                  storyId={story.id}
                  updateId={commentUpdateId === 'all' ? undefined : commentUpdateId}
                  onNotify={onNotify}
                  commentsPaused={story.commentsPaused}
                />
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

  if (variant === 'page') {
    return <div className="story-viewer story-viewer-page">{body}</div>;
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