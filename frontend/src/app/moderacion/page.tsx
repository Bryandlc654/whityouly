'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { fetchAccount, type Account } from '@/lib/account';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import Icon from '@/components/wy/Icon';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import {
  createModerationDecision,
  listAdminAppeals,
  listAdminReports,
  listModerationActions,
  resolveAdminAppeal,
  revertModerationAction,
  type AdminReport,
  type Appeal,
  type AppealStatus,
  type ModerationAction,
  type ModerationActionKind,
  type ModerationDecision,
  type ReportStatus,
} from '@/lib/moderation';

type Tab = 'reports' | 'appeals' | 'history';
type ReportFilter = ReportStatus | 'ALL';
type AppealFilter = AppealStatus | 'ALL';
type HistoryFilter = 'ALL' | 'ACTIVE' | 'REVERTED';

const ALLOWED_ROLES = new Set(['MODERATOR', 'ADMIN', 'SUPERADMIN']);
const PAGE_SIZE = 30;

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

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

function statusLabel(status: ReportStatus): string {
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'IN_REVIEW') return 'En revisión';
  if (status === 'RESOLVED') return 'Resuelto';
  return 'Descartado';
}

function appealStatusLabel(status: AppealStatus): string {
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'ACCEPTED') return 'Aceptada';
  return 'Rechazada';
}

function actionLabel(action: ModerationActionKind): string {
  if (action === 'DISMISS') return 'Reporte descartado';
  if (action === 'HIDE') return 'Contenido ocultado';
  if (action === 'SUSPEND') return 'Perfil suspendido';
  return 'Contenido restaurado';
}

function typeLabel(type: string | null): string {
  if (type === 'STORY') return 'Relato';
  if (type === 'COMMENT') return 'Comentario';
  if (type === 'CHARACTER') return 'Personaje';
  if (type === 'USER') return 'Cuenta';
  if (type === 'CREATION') return 'Creación';
  return 'Contenido';
}

export default function ModerationPage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [fatal, setFatal] = useState('');

  const [tab, setTab] = useState<Tab>('reports');

  const [reportFilter, setReportFilter] = useState<ReportFilter>('PENDING');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportsCursor, setReportsCursor] = useState<string | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');

  const [appealFilter, setAppealFilter] = useState<AppealFilter>('PENDING');
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [appealsCursor, setAppealsCursor] = useState<string | null>(null);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [appealsError, setAppealsError] = useState('');

  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL');
  const [actions, setActions] = useState<ModerationAction[]>([]);
  const [actionsCursor, setActionsCursor] = useState<string | null>(null);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsError, setActionsError] = useState('');

  const [decisionReport, setDecisionReport] = useState<AdminReport | null>(null);
  const [decisionAction, setDecisionAction] = useState<ModerationDecision>('DISMISS');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [decisionBusy, setDecisionBusy] = useState(false);

  const [revertTarget, setRevertTarget] = useState<ModerationAction | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [revertError, setRevertError] = useState('');
  const [revertBusy, setRevertBusy] = useState(false);

  const [appealTarget, setAppealTarget] = useState<{
    appeal: Appeal;
    status: 'ACCEPTED' | 'REJECTED';
  } | null>(null);
  const [appealNote, setAppealNote] = useState('');
  const [appealError, setAppealError] = useState('');
  const [appealBusy, setAppealBusy] = useState(false);

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/login');
        return;
      }

      const [accountResult, meResponse] = await Promise.all([
        fetchAccount(),
        authFetch(`${API_URL}/characters/me`).catch(() => null),
      ]);

      if (!active) return;

      if (accountResult.status !== 'ok') {
        setFatal(accountResult.message);
        setChecking(false);
        return;
      }

      if (
        !ALLOWED_ROLES.has(accountResult.data.role) ||
        accountResult.data.status !== 'ACTIVE'
      ) {
        setForbidden(true);
        setChecking(false);
        return;
      }

      setAccount(accountResult.data);

      if (meResponse?.ok) {
        try {
          setCharacter(await meResponse.json());
        } catch {
          /* el marco funciona sin avatar */
        }
      }

      setChecking(false);
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [router]);

  const loadReports = useCallback(
    async (cursor?: string) => {
      if (!cursor) setReportsError('');
      setReportsLoading(true);

      const result = await listAdminReports({
        cursor,
        status: reportFilter === 'ALL' ? undefined : reportFilter,
        limit: PAGE_SIZE,
      });

      if (result.status === 'ok') {
        setReports((prev) =>
          cursor ? [...prev, ...result.data.items] : result.data.items,
        );
        setReportsCursor(result.data.nextCursor);
      } else {
        setReportsError(result.message);
        if (!cursor) setReports([]);
      }

      setReportsLoading(false);
    },
    [reportFilter],
  );

  const loadAppeals = useCallback(
    async (cursor?: string) => {
      if (!cursor) setAppealsError('');
      setAppealsLoading(true);

      const result = await listAdminAppeals({
        cursor,
        status: appealFilter === 'ALL' ? undefined : appealFilter,
        limit: PAGE_SIZE,
      });

      if (result.status === 'ok') {
        setAppeals((prev) =>
          cursor ? [...prev, ...result.data.items] : result.data.items,
        );
        setAppealsCursor(result.data.nextCursor);
      } else {
        setAppealsError(result.message);
        if (!cursor) setAppeals([]);
      }

      setAppealsLoading(false);
    },
    [appealFilter],
  );

  const loadActions = useCallback(
    async (cursor?: string) => {
      if (!cursor) setActionsError('');
      setActionsLoading(true);

      const result = await listModerationActions({
        cursor,
        status: historyFilter,
        limit: PAGE_SIZE,
      });

      if (result.status === 'ok') {
        setActions((prev) =>
          cursor ? [...prev, ...result.data.items] : result.data.items,
        );
        setActionsCursor(result.data.nextCursor);
      } else {
        setActionsError(result.message);
        if (!cursor) setActions([]);
      }

      setActionsLoading(false);
    },
    [historyFilter],
  );

  useEffect(() => {
    if (checking || forbidden || fatal) return;
    if (tab === 'reports') void loadReports();
  }, [checking, forbidden, fatal, tab, reportFilter, loadReports]);

  useEffect(() => {
    if (checking || forbidden || fatal) return;
    if (tab === 'appeals') void loadAppeals();
  }, [checking, forbidden, fatal, tab, appealFilter, loadAppeals]);

  useEffect(() => {
    if (checking || forbidden || fatal) return;
    if (tab === 'history') void loadActions();
  }, [checking, forbidden, fatal, tab, historyFilter, loadActions]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Ir al Feed', icon: 'home', onClick: () => router.push('/feed') },
        { label: 'Mi cuenta', icon: 'settings', onClick: () => router.push('/cuenta') },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        router.push('/feed');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'mood':
        router.push('/mi-estado');
        break;
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'help':
        router.push('/soporte');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const openDecision = (report: AdminReport) => {
    setDecisionReport(report);
    setDecisionAction(
      report.reportedType === 'STORY' || report.reportedType === 'COMMENT'
        ? 'HIDE'
        : 'DISMISS',
    );
    setDecisionReason('');
    setDecisionError('');
  };

  const submitDecision = async () => {
    if (!decisionReport || decisionBusy) return;
    const reason = decisionReason.trim();
    if (reason.length < 5) {
      setDecisionError('Explica el motivo de la decisión (mínimo 5 caracteres).');
      return;
    }

    setDecisionBusy(true);
    setDecisionError('');

    const result = await createModerationDecision(decisionReport.id, {
      action: decisionAction,
      reason,
    });

    setDecisionBusy(false);

    if (result.status === 'ok') {
      setDecisionReport(null);
      notify('Decisión aplicada y registrada en el historial.');
      void loadReports();
      return;
    }

    setDecisionError(result.message);
  };

  const openRevert = (action: ModerationAction) => {
    setRevertTarget(action);
    setRevertReason('');
    setRevertError('');
  };

  const submitRevert = async () => {
    if (!revertTarget || revertBusy) return;
    const reason = revertReason.trim();
    if (reason.length < 5) {
      setRevertError('Explica el motivo de la reversión (mínimo 5 caracteres).');
      return;
    }

    setRevertBusy(true);
    setRevertError('');

    const result = await revertModerationAction(revertTarget.id, reason);
    setRevertBusy(false);

    if (result.status === 'ok') {
      setRevertTarget(null);
      notify('Decisión revertida. El caso vuelve a pendientes.');
      void loadActions();
      void loadReports();
      return;
    }

    setRevertError(result.message);
  };

  const openAppeal = (appeal: Appeal, status: 'ACCEPTED' | 'REJECTED') => {
    setAppealTarget({ appeal, status });
    setAppealNote('');
    setAppealError('');
  };

  const submitAppeal = async () => {
    if (!appealTarget || appealBusy) return;

    setAppealBusy(true);
    setAppealError('');

    const result = await resolveAdminAppeal(appealTarget.appeal.id, {
      status: appealTarget.status,
      resolutionNote: appealNote.trim() || undefined,
    });

    setAppealBusy(false);

    if (result.status === 'ok') {
      setAppealTarget(null);
      notify(
        appealTarget.status === 'ACCEPTED'
          ? 'Apelación aceptada: el contenido fue restaurado.'
          : 'Apelación rechazada.',
      );
      void loadAppeals();
      void loadActions();
      return;
    }

    setAppealError(result.message);
  };

  const reportFilters: { id: ReportFilter; label: string }[] = [
    { id: 'PENDING', label: 'Pendientes' },
    { id: 'IN_REVIEW', label: 'En revisión' },
    { id: 'RESOLVED', label: 'Resueltos' },
    { id: 'ALL', label: 'Todos' },
  ];

  const appealFilters: { id: AppealFilter; label: string }[] = [
    { id: 'PENDING', label: 'Pendientes' },
    { id: 'ACCEPTED', label: 'Aceptadas' },
    { id: 'REJECTED', label: 'Rechazadas' },
    { id: 'ALL', label: 'Todas' },
  ];

  const historyFilters: { id: HistoryFilter; label: string }[] = [
    { id: 'ALL', label: 'Todo' },
    { id: 'ACTIVE', label: 'Vigentes' },
    { id: 'REVERTED', label: 'Revertidas' },
  ];

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="profile"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen moderation-page">
        <div className="welcome-row">
          <div>
            <h1>Moderación</h1>
            <p className="muted small">
              Revisa reportes, aplica medidas y consulta el historial auditable.
            </p>
          </div>
          {account ? (
            <span className="account-badge">
              <Icon name="shield" /> {account.role}
            </span>
          ) : null}
        </div>

        {checking ? <p className="muted small">Comprobando permisos…</p> : null}

        {!checking && fatal ? (
          <div className="auth-error" role="alert">
            {fatal}
            <button
              className="text-link"
              type="button"
              style={{ marginLeft: 8 }}
              onClick={() => router.push('/feed')}
            >
              Volver al feed
            </button>
          </div>
        ) : null}

        {!checking && forbidden ? (
          <div className="empty card">
            <div className="empty-icon">
              <Icon name="lock" />
            </div>
            <h2>No tienes permiso para moderar</h2>
            <p>Este panel está reservado a moderación y administración.</p>
            <button className="primary" type="button" onClick={() => router.push('/feed')}>
              Volver al feed
            </button>
          </div>
        ) : null}

        {!checking && !forbidden && !fatal ? (
          <>
            <div className="segmented" role="tablist" aria-label="Secciones de moderación">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'reports'}
                className={tab === 'reports' ? 'active' : undefined}
                onClick={() => setTab('reports')}
              >
                Reportes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'appeals'}
                className={tab === 'appeals' ? 'active' : undefined}
                onClick={() => setTab('appeals')}
              >
                Apelaciones
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'history'}
                className={tab === 'history' ? 'active' : undefined}
                onClick={() => setTab('history')}
              >
                Historial
              </button>
            </div>

            {tab === 'reports' ? (
              <>
                <div className="filter-row" role="group" aria-label="Estado de los reportes">
                  {reportFilters.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`filter-pill ${reportFilter === item.id ? 'active' : ''}`.trim()}
                      aria-pressed={reportFilter === item.id}
                      onClick={() => setReportFilter(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {reportsError ? (
                  <div className="auth-error" role="alert">
                    {reportsError}
                    <button
                      className="text-link"
                      type="button"
                      style={{ marginLeft: 8 }}
                      onClick={() => void loadReports()}
                    >
                      Reintentar
                    </button>
                  </div>
                ) : null}

                {reportsLoading && reports.length === 0 ? (
                  <p className="muted small">Cargando reportes…</p>
                ) : null}

                {!reportsLoading && !reportsError && reports.length === 0 ? (
                  <div className="empty card">
                    <div className="empty-icon">
                      <Icon name="check" />
                    </div>
                    <h2>No hay reportes en esta lista</h2>
                    <p>La cola está al día.</p>
                  </div>
                ) : null}

                <div className="stack">
                  {reports.map((report) => (
                    <article className="card pad moderation-case" key={report.id}>
                      <div className="moderation-case-head">
                        <div>
                          <div className="moderation-case-tags">
                            <span className={`status-pill ${report.status === 'RESOLVED' ? 'published' : 'draft'}`}>
                              {statusLabel(report.status)}
                            </span>
                            <span className="tag">{typeLabel(report.reportedType)}</span>
                          </div>
                          <h2>{report.target?.title ?? 'Contenido no disponible'}</h2>
                          <p className="hint">
                            {report.target?.authorName ?? 'Autor no disponible'} · reportado por{' '}
                            {report.reporterCharacterName ?? 'una persona'} ·{' '}
                            {formatDate(report.createdAt)}
                          </p>
                          <p className="moderation-reason">
                            <b>Motivo:</b> {report.reason}
                          </p>
                          {report.target?.context ? (
                            <p className="moderation-context">{report.target.context}</p>
                          ) : null}
                        </div>
                        <button className="primary" type="button" onClick={() => openDecision(report)}>
                          Revisar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {reportsCursor ? (
                  <button
                    className="btn-outline"
                    type="button"
                    disabled={reportsLoading}
                    onClick={() => void loadReports(reportsCursor)}
                  >
                    {reportsLoading ? 'Cargando…' : 'Ver más reportes'}
                  </button>
                ) : null}
              </>
            ) : null}

            {tab === 'appeals' ? (
              <>
                <div className="filter-row" role="group" aria-label="Estado de las apelaciones">
                  {appealFilters.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`filter-pill ${appealFilter === item.id ? 'active' : ''}`.trim()}
                      aria-pressed={appealFilter === item.id}
                      onClick={() => setAppealFilter(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {appealsError ? (
                  <div className="auth-error" role="alert">
                    {appealsError}
                  </div>
                ) : null}

                {appealsLoading && appeals.length === 0 ? (
                  <p className="muted small">Cargando apelaciones…</p>
                ) : null}

                {!appealsLoading && !appealsError && appeals.length === 0 ? (
                  <div className="empty card">
                    <div className="empty-icon">
                      <Icon name="check" />
                    </div>
                    <h2>No hay apelaciones en esta lista</h2>
                  </div>
                ) : null}

                <div className="stack">
                  {appeals.map((appeal) => (
                    <article className="card pad moderation-case" key={appeal.id}>
                      <div className="moderation-case-head">
                        <div>
                          <div className="moderation-case-tags">
                            <span className="tag">{appealStatusLabel(appeal.status)}</span>
                            <span className="tag">{typeLabel(appeal.targetType)}</span>
                          </div>
                          <h2>{appeal.target?.title ?? 'Contenido no disponible'}</h2>
                          <p className="hint">
                            {appeal.appellantCharacterName ?? 'Autor'} ·{' '}
                            {formatDate(appeal.createdAt)}
                          </p>
                          <p className="moderation-reason">{appeal.message}</p>
                          {appeal.resolutionNote ? (
                            <p className="moderation-context">
                              Respuesta: {appeal.resolutionNote}
                            </p>
                          ) : null}
                        </div>
                        {appeal.status === 'PENDING' ? (
                          <div className="moderation-actions">
                            <button
                              className="primary"
                              type="button"
                              onClick={() => openAppeal(appeal, 'ACCEPTED')}
                            >
                              Aceptar
                            </button>
                            <button
                              className="secondary"
                              type="button"
                              onClick={() => openAppeal(appeal, 'REJECTED')}
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>

                {appealsCursor ? (
                  <button
                    className="btn-outline"
                    type="button"
                    disabled={appealsLoading}
                    onClick={() => void loadAppeals(appealsCursor)}
                  >
                    {appealsLoading ? 'Cargando…' : 'Ver más apelaciones'}
                  </button>
                ) : null}
              </>
            ) : null}

            {tab === 'history' ? (
              <>
                <div className="filter-row" role="group" aria-label="Estado del historial">
                  {historyFilters.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`filter-pill ${historyFilter === item.id ? 'active' : ''}`.trim()}
                      aria-pressed={historyFilter === item.id}
                      onClick={() => setHistoryFilter(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {actionsError ? (
                  <div className="auth-error" role="alert">
                    {actionsError}
                  </div>
                ) : null}

                {actionsLoading && actions.length === 0 ? (
                  <p className="muted small">Cargando historial…</p>
                ) : null}

                {!actionsLoading && !actionsError && actions.length === 0 ? (
                  <div className="empty card">
                    <div className="empty-icon">
                      <Icon name="shield" />
                    </div>
                    <h2>Aún no hay decisiones registradas</h2>
                  </div>
                ) : null}

                <div className="stack">
                  {actions.map((action) => (
                    <article className="card pad moderation-audit" key={action.id}>
                      <div className="row-between">
                        <div>
                          <div className="moderation-case-tags">
                            <span className="tag">{actionLabel(action.action)}</span>
                            {action.revertedAt ? (
                              <span className="status-pill draft">Revertida</span>
                            ) : null}
                          </div>
                          <h2>{action.target?.title ?? 'Objetivo no disponible'}</h2>
                          <p className="hint">
                            {action.actorCharacterName ?? 'Moderación'} ·{' '}
                            {formatDate(action.createdAt)}
                          </p>
                          <p className="moderation-reason">
                            <b>Motivo:</b> {action.reason}
                          </p>
                          {action.target?.context ? (
                            <p className="moderation-context">{action.target.context}</p>
                          ) : null}
                          {action.revertedAt ? (
                            <p className="moderation-context">
                              Revertida por {action.revertedByCharacterName ?? 'moderación'} el{' '}
                              {formatDate(action.revertedAt)}
                              {action.revertReason ? `: ${action.revertReason}` : ''}
                            </p>
                          ) : null}
                        </div>
                        {action.canRevert ? (
                          <button className="secondary" type="button" onClick={() => openRevert(action)}>
                            Revertir
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>

                {actionsCursor ? (
                  <button
                    className="btn-outline"
                    type="button"
                    disabled={actionsLoading}
                    onClick={() => void loadActions(actionsCursor)}
                  >
                    {actionsLoading ? 'Cargando…' : 'Ver más historial'}
                  </button>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </section>

      {decisionReport ? (
        <div className="modal-layer" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submitDecision();
            }}
          >
            <div className="modal-head">
              <div>
                <h2 id="decision-title">Revisar reporte</h2>
                <p>{decisionReport.target?.title ?? typeLabel(decisionReport.reportedType)}</p>
              </div>
              <button
                className="close"
                type="button"
                aria-label="Cerrar"
                onClick={() => setDecisionReport(null)}
              >
                <Icon name="x" />
              </button>
            </div>

            <div className="moderation-review-context">
              <p className="hint">
                {decisionReport.target?.authorName ?? 'Autor no disponible'} ·{' '}
                {typeLabel(decisionReport.reportedType)}
              </p>
              <p className="moderation-reason">
                <b>Motivo del reporte:</b> {decisionReport.reason}
              </p>
              {decisionReport.target?.context ? (
                <p className="moderation-context">{decisionReport.target.context}</p>
              ) : null}
            </div>

            <label className="field-label" htmlFor="decision-action">
              Decisión
            </label>
            <select
              id="decision-action"
              className="field"
              value={decisionAction}
              onChange={(event) => setDecisionAction(event.target.value as ModerationDecision)}
            >
              <option value="DISMISS">Resolver sin medida</option>
              <option
                value="HIDE"
                disabled={
                  decisionReport.reportedType !== 'STORY' &&
                  decisionReport.reportedType !== 'COMMENT'
                }
              >
                Retirar contenido
              </option>
              <option value="SUSPEND">Suspender perfil</option>
            </select>

            <label className="field-label" htmlFor="decision-reason">
              Motivo de la decisión
            </label>
            <textarea
              id="decision-reason"
              className="field"
              minLength={5}
              maxLength={1000}
              required
              value={decisionReason}
              onChange={(event) => setDecisionReason(event.target.value)}
              placeholder="Explica qué revisaste y por qué tomas esta decisión."
            />

            {decisionError ? (
              <p className="auth-error" role="alert">
                {decisionError}
              </p>
            ) : null}

            <div className="modal-actions">
              <button
                className="ghost"
                type="button"
                onClick={() => setDecisionReport(null)}
                disabled={decisionBusy}
              >
                Cancelar
              </button>
              <button className="primary" type="submit" disabled={decisionBusy}>
                {decisionBusy ? 'Aplicando…' : 'Aplicar decisión'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {revertTarget ? (
        <div className="modal-layer" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="revert-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submitRevert();
            }}
          >
            <div className="modal-head">
              <div>
                <h2 id="revert-title">Revertir decisión</h2>
                <p>{actionLabel(revertTarget.action)}</p>
              </div>
              <button
                className="close"
                type="button"
                aria-label="Cerrar"
                onClick={() => setRevertTarget(null)}
              >
                <Icon name="x" />
              </button>
            </div>

            <p className="moderation-context">
              Motivo original: {revertTarget.reason}
            </p>

            <label className="field-label" htmlFor="revert-reason">
              Motivo de la reversión
            </label>
            <textarea
              id="revert-reason"
              className="field"
              minLength={5}
              maxLength={1000}
              required
              value={revertReason}
              onChange={(event) => setRevertReason(event.target.value)}
              placeholder="Explica por qué esta medida ya no corresponde."
            />

            {revertError ? (
              <p className="auth-error" role="alert">
                {revertError}
              </p>
            ) : null}

            <div className="modal-actions">
              <button
                className="ghost"
                type="button"
                onClick={() => setRevertTarget(null)}
                disabled={revertBusy}
              >
                Cancelar
              </button>
              <button className="primary" type="submit" disabled={revertBusy}>
                {revertBusy ? 'Revirtiendo…' : 'Revertir decisión'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {appealTarget ? (
        <div className="modal-layer" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appeal-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submitAppeal();
            }}
          >
            <div className="modal-head">
              <div>
                <h2 id="appeal-title">
                  {appealTarget.status === 'ACCEPTED' ? 'Aceptar apelación' : 'Rechazar apelación'}
                </h2>
                <p>{appealTarget.appeal.target?.title ?? 'Contenido'}</p>
              </div>
              <button
                className="close"
                type="button"
                aria-label="Cerrar"
                onClick={() => setAppealTarget(null)}
              >
                <Icon name="x" />
              </button>
            </div>

            <p className="moderation-context">{appealTarget.appeal.message}</p>

            <label className="field-label" htmlFor="appeal-note">
              Nota de resolución (opcional)
            </label>
            <textarea
              id="appeal-note"
              className="field"
              maxLength={1000}
              value={appealNote}
              onChange={(event) => setAppealNote(event.target.value)}
              placeholder="Explica la resolución para la persona que apeló."
            />

            {appealError ? (
              <p className="auth-error" role="alert">
                {appealError}
              </p>
            ) : null}

            <div className="modal-actions">
              <button
                className="ghost"
                type="button"
                onClick={() => setAppealTarget(null)}
                disabled={appealBusy}
              >
                Cancelar
              </button>
              <button className="primary" type="submit" disabled={appealBusy}>
                {appealBusy ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </WyFrame>
  );
}
