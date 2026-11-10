'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/lib/auth';
import ProfileShell from '@/components/wy/ProfileShell';
import {
  listMyReports,
  type MyReport,
  type MyReportStatus,
} from '@/lib/reports';
import { SkeletonList } from '@/components/wy/PageSkeleton';

type Filter = MyReportStatus | 'ALL';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'PENDING', label: 'Pendientes' },
  { id: 'IN_REVIEW', label: 'En revisión' },
  { id: 'RESOLVED', label: 'Resueltos' },
  { id: 'REJECTED', label: 'Sin medida' },
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function statusLabel(status: MyReportStatus): string {
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'IN_REVIEW') return 'En revisión';
  if (status === 'RESOLVED') return 'Resuelto';
  return 'Sin medida';
}

function statusClass(status: MyReportStatus): string {
  if (status === 'RESOLVED') return 'published';
  if (status === 'IN_REVIEW') return 'featured';
  return 'draft';
}

function typeLabel(type: string): string {
  if (type === 'STORY') return 'Relato';
  if (type === 'COMMENT') return 'Comentario';
  if (type === 'CHARACTER') return 'Personaje';
  if (type === 'USER') return 'Cuenta';
  if (type === 'CREATION') return 'Creación';
  return 'Contenido';
}

function targetLabel(report: MyReport): string {
  if (report.target?.title) return report.target.title;
  if (report.target?.authorName) {
    return `${typeLabel(report.reportedType)} de ${report.target.authorName}`;
  }
  return typeLabel(report.reportedType);
}

export default function MyReportsPage() {
  const router = useRouter();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [reports, setReports] = useState<MyReport[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (status: Filter, cursor?: string) => {
      if (!cursor) setError('');
      if (!cursor) setLoading(true);
      else setLoadingMore(true);

      const result = await listMyReports({
        status: status === 'ALL' ? undefined : status,
        cursor,
        limit: 20,
      });

      if (result.status === 'ok') {
        setReports((prev) =>
          cursor ? [...prev, ...result.data.items] : result.data.items,
        );
        setNextCursor(result.data.nextCursor);
      } else {
        setError(result.message);
        if (!cursor) setReports([]);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [],
  );

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace('/login');
      return;
    }
    void load(filter);
  }, [filter, load, router]);

  const empty = !loading && !error && reports.length === 0;

  return (
    <ProfileShell>
      <section className="screen">
        <div className="screen-back">
          <button className="ghost" type="button" onClick={() => router.push('/ayuda')}>
            ← Ayuda
          </button>
          <div>
            <h1>Estado de mis reportes</h1>
            <p>Seguimiento de los reportes guardados en tu cuenta.</p>
          </div>
        </div>

        {empty ? (
          <div className="empty-state">
            <p>Aún no has enviado reportes.</p>
            <button className="secondary" type="button" onClick={() => router.push('/ayuda')}>
              Ver ayuda
            </button>
          </div>
        ) : (
          <>
            <div className="filter-row" role="group" aria-label="Estado de mis reportes">
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

            {loading ? <SkeletonList count={2} /> : null}

            {error ? (
              <div className="auth-error" role="alert">
                {error}
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

            <div className="stack">
              {reports.map((report) => (
                <article className="card pad moderation-case" key={report.id}>
                  <div>
                    <div className="moderation-case-tags">
                      <span className={`status-pill ${statusClass(report.status)}`}>
                        {statusLabel(report.status)}
                      </span>
                      <span className="tag">{typeLabel(report.reportedType)}</span>
                    </div>
                    <h2>{targetLabel(report)}</h2>
                    <p className="hint">
                      {report.target?.authorName
                        ? `Publicado por ${report.target.authorName} · `
                        : ''}
                      Enviado el {formatDate(report.createdAt)}
                      {report.resolvedAt ? ` · Resuelto el ${formatDate(report.resolvedAt)}` : ''}
                    </p>
                    <p className="moderation-reason">
                      <b>Tu motivo:</b> {report.reason}
                    </p>
                    {report.resolution ? (
                      <p className="moderation-context">{report.resolution}</p>
                    ) : (
                      <p className="moderation-context">
                        {report.status === 'IN_REVIEW'
                          ? 'Moderación está revisando este reporte.'
                          : 'El reporte está pendiente de revisión.'}
                      </p>
                    )}
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
                {loadingMore ? 'Cargando…' : 'Ver más reportes'}
              </button>
            ) : null}
          </>
        )}
      </section>
    </ProfileShell>
  );
}
