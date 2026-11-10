'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import Avatar from './Avatar';
import {
  createComment,
  deleteComment,
  editComment,
  listComments,
  reportComment,
  toggleHelpful,
  REPORT_REASONS,
  type ReportReason,
  type StoryComment,
} from '@/lib/comments';

const REASON_LABELS: Record<ReportReason, string> = {
  SPAM: 'Spam',
  HARASSMENT: 'Acoso',
  OFFENSIVE: 'Ofensivo',
  SEXUAL: 'Contenido sexual',
  THREATS: 'Amenazas',
  IMPERSONATION: 'Suplantación',
  ILLEGAL: 'Ilegal',
  OTHER: 'Otro motivo',
};

interface Props {
  storyId: string;
  title: string;
  author: string;
  viewerName?: string;
  viewerAvatarUrl?: string | null;
  onClose: () => void;
  onNotify?: (message: string) => void;
}

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase();

function relativeTime(value: string): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  const unit = (n: number, one: string, many: string) => `Hace ${n} ${n === 1 ? one : many}`;
  if (minutes < 5) return 'Hace un momento';
  if (minutes < 60) return unit(minutes, 'minuto', 'minutos');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return unit(hours, 'hora', 'horas');
  const days = Math.round(hours / 24);
  if (days < 7) return unit(days, 'día', 'días');
  if (days < 30) return unit(Math.round(days / 7), 'semana', 'semanas');
  return unit(Math.round(days / 30), 'mes', 'meses');
}

/**
 * Panel lateral de comentarios con el marcado de v58 (#commentsLayer):
 * fondo, encabezado, conversación con respuestas y redacción fija abajo.
 */
export default function CommentsPanel({ storyId, title, author, viewerName, viewerAvatarUrl, onClose, onNotify }: Props) {
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<StoryComment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openReplies, setOpenReplies] = useState<Set<string>>(new Set());
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const notify = onNotify ?? (() => undefined);

  const load = useCallback(async () => {
    const result = await listComments(storyId);
    setLoading(false);
    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }
    setError('');
    setComments(result.data.items);
    setCount(result.data.commentCount);
  }, [storyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const submit = async () => {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    const result = editingId
      ? await editComment(editingId, content)
      : await createComment(storyId, { content, parentId: replyTo ? replyTo.parentId ?? replyTo.id : undefined });
    setBusy(false);
    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }
    if (replyTo) setOpenReplies((prev) => new Set(prev).add(replyTo.parentId ?? replyTo.id));
    setText('');
    setReplyTo(null);
    setEditingId(null);
    notify(editingId ? 'Comentario editado.' : 'Comentario publicado.');
    await load();
  };

  const like = async (comment: StoryComment) => {
    const result = await toggleHelpful(comment.id);
    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }
    setComments((prev) =>
      prev.map((item) =>
        item.id === comment.id ? { ...item, helpfulByMe: result.data.helpful, helpfulCount: result.data.count } : item,
      ),
    );
  };

  const confirmDelete = async () => {
    if (!deleteFor) return;
    setBusy(true);
    const result = await deleteComment(deleteFor);
    setBusy(false);
    setDeleteFor(null);
    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }
    notify('Comentario eliminado.');
    await load();
  };

  const report = async (id: string, reason: ReportReason) => {
    const result = await reportComment(id, reason);
    setReportFor(null);
    if (result.status === 'ok') notify('Reporte enviado a revisión.');
    else setError(result.message);
  };

  const topLevel = comments.filter((comment) => !comment.parentId);
  const replies = (id: string) => comments.filter((comment) => comment.parentId === id);

  const renderComment = (comment: StoryComment, isReply = false) => {
    const children = isReply ? [] : replies(comment.id);
    return (
      <article
        key={comment.id}
        className={`conversation-comment ${isReply ? 'conversation-reply' : ''}`}
        id={`comment-${comment.id}`}
      >
        <Avatar initials={initials(comment.author.name)} avatarUrl={comment.author.avatarUrl} size="md" />
        <div className="conversation-copy">
          <div className="conversation-author">
            <b>{comment.author.name}</b>
            {comment.author.name === author ? <span>Autor</span> : null}
          </div>
          <p>{comment.deleted ? 'Comentario eliminado' : comment.content}</p>
          {!comment.deleted ? (
            <div className="conversation-meta">
              <span>{relativeTime(comment.createdAt)}</span>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setReplyTo(comment);
                  textRef.current?.focus();
                }}
              >
                Responder
              </button>
              {comment.isOwn ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(null);
                      setEditingId(comment.id);
                      setText(comment.content ?? '');
                      textRef.current?.focus();
                    }}
                  >
                    Editar
                  </button>
                  <button type="button" onClick={() => setDeleteFor(comment.id)}>
                    Eliminar
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setReportFor(reportFor === comment.id ? null : comment.id)}>
                  Reportar
                </button>
              )}
            </div>
          ) : null}
          {reportFor === comment.id ? (
            <div className="filter-row">
              {REPORT_REASONS.map((reason) => (
                <button key={reason} type="button" className="filter-pill" onClick={() => void report(comment.id, reason)}>
                  {REASON_LABELS[reason]}
                </button>
              ))}
            </div>
          ) : null}
          {children.length ? (
            <>
              <button
                type="button"
                className="view-replies"
                aria-expanded={openReplies.has(comment.id)}
                onClick={() =>
                  setOpenReplies((prev) => {
                    const next = new Set(prev);
                    if (next.has(comment.id)) next.delete(comment.id);
                    else next.add(comment.id);
                    return next;
                  })
                }
              >
                {openReplies.has(comment.id) ? 'Ocultar respuestas' : `Ver respuestas (${children.length})`}
              </button>
              <div className="conversation-replies" hidden={!openReplies.has(comment.id)}>
                {children.map((child) => renderComment(child, true))}
              </div>
            </>
          ) : null}
        </div>
        {!comment.deleted ? (
          <button
            type="button"
            className={`conversation-like ${comment.helpfulByMe ? 'active' : ''}`}
            aria-label="Estoy contigo en este comentario"
            aria-pressed={comment.helpfulByMe}
            onClick={() => void like(comment)}
          >
            <Icon name="heart" />
            <small>{comment.helpfulCount}</small>
          </button>
        ) : null}
      </article>
    );
  };

  return (
    <div id="commentsLayer">
      <button className="conversation-backdrop" type="button" aria-label="Cerrar los comentarios" onClick={onClose} />
      <section className="conversation-panel" role="dialog" aria-modal="true" aria-labelledby="conversationTitle">
        <div className="panel-handle" aria-hidden="true" />
        <header className="conversation-heading">
          <div>
            <h2 id="conversationTitle" tabIndex={-1}>
              Comentarios <span>{count}</span>
            </h2>
            <p>
              {author} · {title}
            </p>
          </div>
          <button className="icon-btn" type="button" aria-label="Cerrar comentarios" onClick={onClose}>
            <Icon name="x" />
          </button>
        </header>
        <div className="conversation-body" tabIndex={-1}>
          {loading ? <p>Cargando comentarios…</p> : null}
          {!loading && !error && topLevel.length === 0 ? <p>Todavía no hay comentarios. Puedes acompañar con tus palabras.</p> : null}
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          {topLevel.map((comment) => renderComment(comment))}
        </div>
        <div className="comment-delete-confirm" hidden={!deleteFor}>
          <p>¿Eliminar este comentario y sus respuestas?</p>
          <button className="ghost" type="button" onClick={() => setDeleteFor(null)}>
            Conservar
          </button>
          <button className="ghost danger" type="button" onClick={() => void confirmDelete()} disabled={busy}>
            Eliminar
          </button>
        </div>
        <form
          className="conversation-compose"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="reply-context" hidden={!replyTo && !editingId}>
            <span>{editingId ? 'Editando tu comentario' : replyTo ? `Respondiendo a ${replyTo.author.name}` : ''}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Cancelar respuesta"
              onClick={() => {
                setReplyTo(null);
                setEditingId(null);
                setText('');
              }}
            >
              <Icon name="x" />
            </button>
          </div>
          <div className="conversation-field">
            <Avatar initials={initials(viewerName ?? 'Tú')} avatarUrl={viewerAvatarUrl} size="md" />
            <textarea
              ref={textRef}
              rows={1}
              maxLength={1200}
              placeholder="Acompaña con tus palabras…"
              aria-label="Escribe un comentario"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <button className="text-link" type="submit" disabled={busy}>
              Publicar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
