'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';
import Avatar from './Avatar';
import {
  createComment,
  deleteComment,
  editComment,
  listComments,
  reportComment,
  REPORT_REASONS,
  type ReportReason,
  type StoryComment,
} from '@/lib/comments';

interface Props {
  storyId: string;
  onNotify?: (message: string) => void;
}

function relativeTime(value: string): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const diff = Date.now() - time;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `Hace ${days} d`;
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(time));
}

export default function CommentSection({ storyId, onNotify }: Props) {
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [localNote, setLocalNote] = useState('');

  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [reportFor, setReportFor] = useState<string | null>(null);

  const notify = onNotify ?? ((message: string) => setLocalNote(message));

  const load = useCallback(
    async (reset = true) => {
      if (reset) setLoading(true);
      setError('');
      const result = await listComments(storyId, reset ? undefined : (nextCursor ?? undefined));
      if (result.status !== 'ok') {
        setError(result.message);
        setLoading(false);
        return;
      }
      setComments((prev) => (reset ? result.data.items : [...prev, ...result.data.items]));
      setNextCursor(result.data.nextCursor);
      setCommentCount(result.data.commentCount);
      setLoading(false);
    },
    [storyId, nextCursor],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (content: string, parentId?: string) => {
    if (!content.trim() || busy) return;
    setBusy(true);
    setError('');
    const result = await createComment(storyId, { content: content.trim(), parentId });
    setBusy(false);

    if (result.status === 'ok') {
      setDraft('');
      setReplyDraft('');
      setReplyingTo(null);
      await load(true);
      notify('Comentario publicado.');
      return;
    }
    setError(result.message);
  };

  const saveEdit = async (id: string) => {
    if (!editDraft.trim() || busy) return;
    setBusy(true);
    setError('');
    const result = await editComment(id, editDraft.trim());
    setBusy(false);

    if (result.status === 'ok') {
      setEditingId(null);
      await load(true);
      notify('Comentario editado.');
      return;
    }
    setError(result.message);
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError('');
    const result = await deleteComment(id);
    setBusy(false);

    if (result.status === 'ok') {
      await load(true);
      notify('Comentario eliminado.');
      return;
    }
    setError(result.message);
  };

  const report = async (id: string, reason: ReportReason) => {
    setBusy(true);
    setError('');
    const result = await reportComment(id, reason);
    setBusy(false);

    setReportFor(null);
    if (result.status === 'ok') {
      notify('Reporte enviado a revisión.');
      return;
    }
    setError(result.message);
  };

  const topLevel = comments.filter((comment) => !comment.parentId);
  const replyMap = new Map<string, StoryComment[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const list = replyMap.get(comment.parentId) ?? [];
    list.push(comment);
    replyMap.set(comment.parentId, list);
  }

  const renderComment = (comment: StoryComment) => {
    const editing = editingId === comment.id;
    const replying = replyingTo === comment.id;
    const reporting = reportFor === comment.id;

    return (
      <div key={comment.id} className={`comment-item ${comment.deleted ? 'deleted' : ''}`}>
        <div className="comment-head">
          <Avatar initials={comment.author.name.trim().slice(0, 2).toUpperCase()} avatarUrl={comment.author.avatarUrl} size="sm" />
          <div>
            <b>{comment.author.name}</b>
            <span className="hint">{relativeTime(comment.createdAt)}</span>
            {comment.isOwn ? <span className="tag update">Tú</span> : null}
          </div>
        </div>

        {editing ? (
          <div className="comment-edit">
            <textarea
              className="field"
              value={editDraft}
              maxLength={2000}
              onChange={(event) => setEditDraft(event.target.value)}
            />
            <div className="modal-actions" style={{ marginTop: 6 }}>
              <button className="ghost" type="button" onClick={() => setEditingId(null)} disabled={busy}>
                Cancelar
              </button>
              <button className="primary sm" type="button" onClick={() => void saveEdit(comment.id)} disabled={busy || editDraft.trim().length === 0}>
                Guardar
              </button>
            </div>
          </div>
        ) : comment.deleted ? (
          <p className="comment-deleted">Comentario eliminado</p>
        ) : (
          <p className="comment-body">{comment.content}</p>
        )}

        {!comment.deleted ? (
          <div className="comment-actions">
            <button
              type="button"
              className="action-link"
              onClick={() => {
                setReplyingTo(replying ? null : comment.id);
                setReportFor(null);
              }}
            >
              <Icon name="message" /> Responder
            </button>
            {comment.isOwn ? (
              <>
                <button
                  type="button"
                  className="action-link"
                  onClick={() => {
                    setEditingId(comment.id);
                    setEditDraft(comment.content ?? '');
                  }}
                  disabled={busy}
                >
                  <Icon name="edit" /> Editar
                </button>
                <button type="button" className="action-link danger" onClick={() => void remove(comment.id)} disabled={busy}>
                  <Icon name="trash" /> Eliminar
                </button>
              </>
            ) : (
              <button
                type="button"
                className="action-link danger"
                onClick={() => setReportFor(reporting ? null : comment.id)}
              >
                <Icon name="flag" /> Reportar
              </button>
            )}
          </div>
        ) : null}

        {replying ? (
          <div className="reply-composer">
            <textarea
              className="field"
              value={replyDraft}
              maxLength={2000}
              placeholder="Escribe tu respuesta…"
              onChange={(event) => setReplyDraft(event.target.value)}
            />
            <div className="modal-actions" style={{ marginTop: 6 }}>
              <button className="ghost" type="button" onClick={() => setReplyingTo(null)} disabled={busy}>
                Cancelar
              </button>
              <button
                className="primary sm"
                type="button"
                onClick={() => void submit(replyDraft, comment.id)}
                disabled={busy || replyDraft.trim().length === 0}
              >
                Responder
              </button>
            </div>
          </div>
        ) : null}

        {reporting ? (
          <div className="report-reasons">
            <span className="hint">¿Por qué lo reportas?</span>
            <div className="chip-row">
              {REPORT_REASONS.map((reason) => (
                <button key={reason} type="button" className="chip" onClick={() => void report(comment.id, reason)} disabled={busy}>
                  {reason.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {(replyMap.get(comment.id) ?? []).map((reply) => (
          <div key={reply.id} className="comment-reply">
            {renderComment(reply)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="comments" aria-label="Comentarios">
      <h3 className="comments-title">
        {commentCount} {commentCount === 1 ? 'comentario' : 'comentarios'}
      </h3>

      {localNote ? <p className="hint">{localNote}</p> : null}
      {error ? (
        <p className="auth-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}

      <div className="comment-composer">
        <textarea
          className="field"
          value={draft}
          maxLength={2000}
          placeholder="Comparte una palabra de apoyo o lo que sientas."
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          className="primary sm"
          type="button"
          onClick={() => void submit(draft)}
          disabled={busy || draft.trim().length === 0}
        >
          <Icon name="send" /> Comentar
        </button>
      </div>

      {loading ? <p className="hint">Cargando comentarios…</p> : null}

      <div className="comment-list">
        {topLevel.length > 0 ? topLevel.map(renderComment) : !loading && !error ? (
          <p className="hint" style={{ padding: '8px 0' }}>
            Sé la primera persona en comentar.
          </p>
        ) : null}
      </div>

      {nextCursor ? (
        <button className="btn-outline" type="button" disabled={busy} onClick={() => void load(false)}>
          Ver más comentarios
        </button>
      ) : null}
    </section>
  );
}