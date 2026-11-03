'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/wy/Icon';
import {
  listSessions,
  revokeOtherSessions,
  revokeSession,
  type AuthSession,
} from '@/lib/sessions';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function SessionsSection() {
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listSessions();
    setLoading(false);

    if (result.status === 'ok') {
      setSessions(result.data);
      setError('');
      return;
    }

    setError(result.message);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closeOne = async (session: AuthSession) => {
    if (busyId || busyAll) return;

    setBusyId(session.id);
    setError('');
    setNotice('');

    const result = await revokeSession(session.id);
    setBusyId(null);

    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }

    setNotice('Sesión cerrada.');
    await load();
  };

  const closeOthers = async () => {
    if (busyAll || busyId) return;

    setBusyAll(true);
    setError('');
    setNotice('');

    const result = await revokeOtherSessions();
    setBusyAll(false);

    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }

    setNotice(
      result.data.revokedCount > 0
        ? `Se cerraron ${result.data.revokedCount} ${
            result.data.revokedCount === 1 ? 'sesión' : 'sesiones'
          } en otros dispositivos.`
        : 'No había otras sesiones abiertas.',
    );
    await load();
  };

  const hasOthers = sessions.some((session) => !session.current);

  return (
    <section className="stack" aria-labelledby="sessions-title">
      <div className="section-heading">
        <div>
          <h2 id="sessions-title">Dispositivos con acceso</h2>
          <p>Cierra cualquier sesión que no reconozcas.</p>
        </div>
        <button
          className="text-link"
          type="button"
          onClick={() => void closeOthers()}
          disabled={!hasOthers || busyAll || loading}
        >
          {busyAll ? 'Cerrando…' : 'Cerrar las demás'}
        </button>
      </div>

      {error ? (
        <div className="auth-error" role="alert">
          {error}
          <button className="text-link" type="button" style={{ marginLeft: 8 }} onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {notice ? (
        <p className="auth-success" role="status" style={{ margin: 0 }}>
          {notice}
        </p>
      ) : null}

      {loading ? <p className="muted small">Cargando dispositivos…</p> : null}

      {!loading && sessions.length === 0 && !error ? (
        <p className="hint">No hay sesiones activas registradas.</p>
      ) : null}

      {sessions.map((session) => (
        <section className="device-card card" key={session.id}>
          <span>
            <Icon name={session.current ? 'check' : 'user'} />
          </span>
          <div>
            <b>{session.deviceInfo || 'Dispositivo desconocido'}</b>
            <small>
              {session.ipAddress ? `${session.ipAddress} · ` : ''}
              {session.current ? 'Sesión actual' : `Inició el ${formatDate(session.createdAt)}`}
            </small>
          </div>
          {session.current ? (
            <span className="status-pill safe">Este dispositivo</span>
          ) : (
            <button
              className="secondary"
              type="button"
              disabled={busyId === session.id || busyAll}
              onClick={() => void closeOne(session)}
            >
              {busyId === session.id ? 'Cerrando…' : 'Cerrar sesión'}
            </button>
          )}
        </section>
      ))}
    </section>
  );
}
