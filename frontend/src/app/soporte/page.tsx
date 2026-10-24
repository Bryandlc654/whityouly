'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/lib/auth';
import ProfileShell from '@/components/wy/ProfileShell';
import Icon from '@/components/wy/Icon';
import {
  createSupportTicket,
  listMySupportTickets,
  SUPPORT_BODY_MAX_LENGTH,
  SUPPORT_BODY_MIN_LENGTH,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
  type SupportCategory,
  type SupportStatus,
  type SupportTicket,
} from '@/lib/support';

type Tab = 'new' | 'mine';
type Filter = SupportStatus | 'ALL';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'Todas' },
  { id: 'OPEN', label: 'Abiertas' },
  { id: 'IN_PROGRESS', label: 'En revisión' },
  { id: 'RESOLVED', label: 'Resueltas' },
  { id: 'CLOSED', label: 'Cerradas' },
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusClass(status: SupportStatus): string {
  if (status === 'RESOLVED') return 'published';
  if (status === 'IN_PROGRESS') return 'featured';
  return 'draft';
}

export default function SupportPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('new');
  const [category, setCategory] = useState<SupportCategory>('ACCOUNT');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [formNotice, setFormNotice] = useState('');

  const [filter, setFilter] = useState<Filter>('ALL');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (status: Filter, cursor?: string) => {
    if (!cursor) {
      setListError('');
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const result = await listMySupportTickets({
      status: status === 'ALL' ? undefined : status,
      cursor,
      limit: 20,
    });

    if (result.status === 'ok') {
      setTickets((prev) =>
        cursor ? [...prev, ...result.data.items] : result.data.items,
      );
      setNextCursor(result.data.nextCursor);
    } else {
      setListError(result.message);
      if (!cursor) setTickets([]);
    }

    setLoaded(true);
    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace('/login');
      return;
    }
    void load(filter);
  }, [filter, load, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;

    const text = body.trim();
    if (text.length < SUPPORT_BODY_MIN_LENGTH) {
      setFormError(`Cuéntanos un poco más (mínimo ${SUPPORT_BODY_MIN_LENGTH} caracteres).`);
      return;
    }

    setSending(true);
    setFormError('');
    setFormNotice('');

    const result = await createSupportTicket({ category, body: text });

    setSending(false);

    if (result.status !== 'ok') {
      setFormError(result.message);
      return;
    }

    setBody('');
    setFormNotice('Solicitud enviada. Puedes seguir su estado en “Mis solicitudes”.');
    setTab('mine');
    setFilter('ALL');
    void load('ALL');
  };

  return (
    <ProfileShell>
      <section className="screen">
        <div className="screen-heading">
          <div>
            <h1>Ayuda y soporte</h1>
            <p>Escríbenos y sigue el estado de tus solicitudes.</p>
          </div>
          <button className="ghost" type="button" onClick={() => router.push('/cuenta')}>
            Volver a configuración
          </button>
        </div>

        {formNotice ? (
          <p className="auth-success" role="status">
            {formNotice}
          </p>
        ) : null}

        <div className="segmented" role="tablist" aria-label="Soporte">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'new'}
            className={tab === 'new' ? 'active' : undefined}
            onClick={() => setTab('new')}
          >
            Contactar soporte
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mine'}
            className={tab === 'mine' ? 'active' : undefined}
            onClick={() => {
              setTab('mine');
              if (!loaded) void load(filter);
            }}
          >
            Mis solicitudes
          </button>
        </div>

        {tab === 'new' ? (
          <form className="editor card" onSubmit={(event) => void submit(event)}>
            {formError ? (
              <p className="auth-error" role="alert" style={{ marginTop: 0 }}>
                {formError}
              </p>
            ) : null}
            <label htmlFor="support-category">Motivo</label>
            <select
              id="support-category"
              className="field"
              value={category}
              onChange={(event) => setCategory(event.target.value as SupportCategory)}
              disabled={sending}
            >
              {SUPPORT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {SUPPORT_CATEGORY_LABELS[item]}
                </option>
              ))}
            </select>

            <label htmlFor="support-body">Cuéntanos qué ocurrió</label>
            <textarea
              id="support-body"
              className="field"
              minLength={SUPPORT_BODY_MIN_LENGTH}
              maxLength={SUPPORT_BODY_MAX_LENGTH}
              required
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Incluye lo necesario para entender el caso. No escribas contraseñas ni datos sensibles."
              disabled={sending}
            />
            <span className="char-count">
              {body.length}/{SUPPORT_BODY_MAX_LENGTH}
            </span>

            <div className="moderation-context" style={{ marginTop: 14 }}>
              Por seguridad, no incluyas contraseñas, códigos de acceso ni datos de pago. El
              equipo de soporte nunca te los pedirá por este medio.
            </div>

            <div className="editor-actions">
              <span className="char-count" />
              <div>
                <button className="primary" type="submit" disabled={sending}>
                  {sending ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <>
            <div className="filter-row" role="group" aria-label="Estado de mis solicitudes">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`filter-pill ${filter === item.id ? 'active' : ''}`.trim()}
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {loading ? <p className="muted small">Cargando tus solicitudes…</p> : null}

            {listError ? (
              <div className="auth-error" role="alert">
                {listError}
                <button
                  className="text-link"
                  type="button"
                  style={{ marginLeft: 8 }}
                  onClick={() => void load(filter)}
                >
                  Reintentar
                </button>
              </div>
            ) : null}

            {!loading && !listError && tickets.length === 0 ? (
              <div className="empty card">
                <div className="empty-icon">
                  <Icon name="mail" />
                </div>
                <h2>No hay solicitudes en esta lista</h2>
                <p>Cuando contactes con soporte, tu caso aparecerá aquí.</p>
                <button className="secondary" type="button" onClick={() => setTab('new')}>
                  Contactar soporte
                </button>
              </div>
            ) : null}

            <div className="stack">
              {tickets.map((ticket) => (
                <article className="card pad moderation-case" key={ticket.id}>
                  <div>
                    <div className="moderation-case-tags">
                      <span className={`status-pill ${statusClass(ticket.status)}`}>
                        {SUPPORT_STATUS_LABELS[ticket.status]}
                      </span>
                      <span className="tag">{SUPPORT_CATEGORY_LABELS[ticket.category]}</span>
                    </div>
                    <h2>{SUPPORT_CATEGORY_LABELS[ticket.category]}</h2>
                    <p className="hint">
                      Enviada el {formatDate(ticket.createdAt)}
                      {ticket.resolvedAt ? ` · Resuelta el ${formatDate(ticket.resolvedAt)}` : ''}
                    </p>
                    <p className="moderation-reason">{ticket.body}</p>
                    {ticket.resolutionNote ? (
                      <p className="moderation-context">
                        <b>Respuesta de soporte:</b> {ticket.resolutionNote}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {nextCursor ? (
              <button
                className="btn-outline"
                type="button"
                disabled={loadingMore}
                onClick={() => {
                  if (!nextCursor || loadingMore) return;
                  void load(filter, nextCursor);
                }}
              >
                {loadingMore ? 'Cargando…' : 'Ver más solicitudes'}
              </button>
            ) : null}
          </>
        )}
      </section>
    </ProfileShell>
  );
}
