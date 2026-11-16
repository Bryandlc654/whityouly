'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';
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
import {
  moderateAdminReportContent,
  updateAdminReportStatus,
} from '@/lib/admin';
import { formatAdminDateTime } from './helpers';
import type { AdminNotify } from './types';

type Mode = 'reports' | 'appeals' | 'history';
type ReportFilter = ReportStatus | 'ALL';
type AppealFilter = AppealStatus | 'ALL';
type HistoryFilter = 'ALL' | 'ACTIVE' | 'REVERTED';
type ActionFilter = ModerationActionKind | 'ALL';
type TypeFilter = 'ALL' | 'STORY' | 'COMMENT';

const PAGE_SIZE = 30;

export default function AdminModerationPanel({
  mode,
  notify,
}: {
  mode: Mode;
  notify: AdminNotify;
}) {
  const { t, language } = useI18n();

  const [reportFilter, setReportFilter] = useState<ReportFilter>('PENDING');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
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
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');
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

  const [quickBusy, setQuickBusy] = useState<string | null>(null);

  const loadReports = useCallback(
    async (cursor?: string) => {
      if (!cursor) setReportsError('');
      setReportsLoading(true);
      const result = await listAdminReports({
        cursor,
        status: reportFilter === 'ALL' ? undefined : reportFilter,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        limit: PAGE_SIZE,
      });
      if (result.status === 'ok') {
        setReports((prev) => (cursor ? [...prev, ...result.data.items] : result.data.items));
        setReportsCursor(result.data.nextCursor);
      } else {
        setReportsError(result.message);
        if (!cursor) setReports([]);
      }
      setReportsLoading(false);
    },
    [reportFilter, typeFilter],
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
        setAppeals((prev) => (cursor ? [...prev, ...result.data.items] : result.data.items));
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
        action: actionFilter === 'ALL' ? undefined : actionFilter,
        status: historyFilter,
        limit: PAGE_SIZE,
      });
      if (result.status === 'ok') {
        setActions((prev) => (cursor ? [...prev, ...result.data.items] : result.data.items));
        setActionsCursor(result.data.nextCursor);
      } else {
        setActionsError(result.message);
        if (!cursor) setActions([]);
      }
      setActionsLoading(false);
    },
    [historyFilter, actionFilter],
  );

  useEffect(() => {
    if (mode === 'reports') void loadReports();
  }, [mode, loadReports]);

  useEffect(() => {
    if (mode === 'appeals') void loadAppeals();
  }, [mode, loadAppeals]);

  useEffect(() => {
    if (mode === 'history') void loadActions();
  }, [mode, loadActions]);

  const openDecision = (report: AdminReport) => {
    setDecisionReport(report);
    setDecisionAction(
      report.reportedType === 'STORY' || report.reportedType === 'COMMENT' ? 'HIDE' : 'DISMISS',
    );
    setDecisionReason('');
    setDecisionError('');
  };

  const submitDecision = async () => {
    if (!decisionReport || decisionBusy) return;
    const reason = decisionReason.trim();
    if (reason.length < 5) {
      setDecisionError(t('admin.mod.reasonMin'));
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
      notify(t('admin.mod.decisionSaved'));
      void loadReports();
      return;
    }
    setDecisionError(result.message);
  };

  const quickReportAction = async (report: AdminReport, action: 'IN_REVIEW' | 'REOPEN' | 'RESTORE') => {
    if (quickBusy) return;
    setQuickBusy(`${report.id}:${action}`);
    const result =
      action === 'RESTORE'
        ? await moderateAdminReportContent(report.id, 'RESTORE')
        : await updateAdminReportStatus(report.id, action === 'IN_REVIEW' ? 'IN_REVIEW' : 'PENDING');
    setQuickBusy(null);
    if (result.status === 'ok') {
      notify(
        action === 'RESTORE'
          ? t('admin.mod.contentRestored')
          : action === 'IN_REVIEW'
            ? t('admin.mod.movedToReview')
            : t('admin.mod.reopened'),
      );
      void loadReports();
      return;
    }
    notify(result.message);
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
      setRevertError(t('admin.mod.revertReasonMin'));
      return;
    }
    setRevertBusy(true);
    setRevertError('');
    const result = await revertModerationAction(revertTarget.id, reason);
    setRevertBusy(false);
    if (result.status === 'ok') {
      setRevertTarget(null);
      notify(t('admin.mod.reverted'));
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
      notify(
        appealTarget.status === 'ACCEPTED'
          ? t('admin.mod.appealAccepted')
          : t('admin.mod.appealRejected'),
      );
      setAppealTarget(null);
      void loadAppeals();
      void loadActions();
      return;
    }
    setAppealError(result.message);
  };

  const reportFilters: { id: ReportFilter; label: string }[] = [
    { id: 'PENDING', label: t('admin.mod.status.PENDING') },
    { id: 'IN_REVIEW', label: t('admin.mod.status.IN_REVIEW') },
    { id: 'RESOLVED', label: t('admin.mod.status.RESOLVED') },
    { id: 'REJECTED', label: t('admin.mod.status.REJECTED') },
    { id: 'ALL', label: t('admin.mod.all') },
  ];

  const appealFilters: { id: AppealFilter; label: string }[] = [
    { id: 'PENDING', label: t('admin.mod.status.PENDING') },
    { id: 'ACCEPTED', label: t('admin.mod.status.ACCEPTED') },
    { id: 'REJECTED', label: t('admin.mod.status.REJECTED') },
    { id: 'ALL', label: t('admin.mod.all') },
  ];

  const historyFilters: { id: HistoryFilter; label: string }[] = [
    { id: 'ALL', label: t('admin.mod.all') },
    { id: 'ACTIVE', label: t('admin.mod.active') },
    { id: 'REVERTED', label: t('admin.mod.revertedFilter') },
  ];

  const actionFilters: { id: ActionFilter; label: string }[] = [
    { id: 'ALL', label: t('admin.mod.allActions') },
    { id: 'DISMISS', label: t('admin.mod.action.DISMISS') },
    { id: 'HIDE', label: t('admin.mod.action.HIDE') },
    { id: 'SUSPEND', label: t('admin.mod.action.SUSPEND') },
    { id: 'RESTORE', label: t('admin.mod.action.RESTORE') },
    { id: 'DELETE', label: t('admin.mod.action.DELETE') },
  ];

  return (
    <div className="stack">
      {mode === 'reports' ? (
        <>
          <div className="admin-filter-stack">
            <div className="filter-row" role="group" aria-label={t('admin.mod.reportFilterAria')}>
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
            <div className="filter-row" role="group" aria-label={t('admin.mod.typeFilterAria')}>
              {(['ALL', 'STORY', 'COMMENT'] as TypeFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`filter-pill ${typeFilter === item ? 'active' : ''}`.trim()}
                  aria-pressed={typeFilter === item}
                  onClick={() => setTypeFilter(item)}
                >
                  {item === 'ALL' ? t('admin.mod.allTypes') : t(`admin.mod.type.${item}`)}
                </button>
              ))}
            </div>
          </div>

          {reportsError ? (
            <div className="auth-error" role="alert">
              {reportsError}
              <button className="text-link" type="button" style={{ marginLeft: 8 }} onClick={() => void loadReports()}>
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {reportsLoading && reports.length === 0 ? (
            <p className="muted small">{t('admin.mod.loadingReports')}</p>
          ) : null}

          {!reportsLoading && !reportsError && reports.length === 0 ? (
            <div className="empty card">
              <div className="empty-icon">
                <Icon name="check" />
              </div>
              <h2>{t('admin.mod.emptyReportsTitle')}</h2>
              <p>{t('admin.mod.emptyReportsCopy')}</p>
            </div>
          ) : null}

          <div className="stack">
            {reports.map((report) => (
              <article className="card pad moderation-case" key={report.id}>
                <div className="moderation-case-head">
                  <div>
                    <div className="moderation-case-tags">
                      <span className={`status-pill ${report.status === 'RESOLVED' ? 'published' : 'draft'}`}>
                        {t(`admin.mod.status.${report.status}`)}
                      </span>
                      <span className="tag">{t(`admin.mod.type.${report.reportedType}`)}</span>
                    </div>
                    <h2>{report.target?.title ?? t('admin.mod.contentUnavailable')}</h2>
                    <p className="hint">
                      {report.target?.authorName ?? t('admin.mod.authorUnavailable')} ·{' '}
                      {t('admin.mod.reportedBy')} {report.reporterCharacterName ?? t('admin.mod.someone')} ·{' '}
                      {formatAdminDateTime(report.createdAt, language)}
                    </p>
                    <p className="moderation-reason">
                      <b>{t('admin.mod.reason')}:</b> {report.reason}
                    </p>
                    {report.target?.context ? (
                      <p className="moderation-context">{report.target.context}</p>
                    ) : null}
                  </div>
                  <div className="moderation-actions">
                    {report.status === 'PENDING' ? (
                      <button
                        className="secondary"
                        type="button"
                        disabled={quickBusy !== null}
                        onClick={() => void quickReportAction(report, 'IN_REVIEW')}
                      >
                        {quickBusy === `${report.id}:IN_REVIEW`
                          ? t('admin.mod.working')
                          : t('admin.mod.markReview')}
                      </button>
                    ) : null}
                    {report.status === 'RESOLVED' || report.status === 'REJECTED' ? (
                      <button
                        className="secondary"
                        type="button"
                        disabled={quickBusy !== null}
                        onClick={() => void quickReportAction(report, 'REOPEN')}
                      >
                        {quickBusy === `${report.id}:REOPEN`
                          ? t('admin.mod.working')
                          : t('admin.mod.reopen')}
                      </button>
                    ) : null}
                    {report.target?.status === 'HIDDEN' || report.target?.status === 'MODERATED' ? (
                      <button
                        className="secondary"
                        type="button"
                        disabled={quickBusy !== null}
                        onClick={() => void quickReportAction(report, 'RESTORE')}
                      >
                        {quickBusy === `${report.id}:RESTORE`
                          ? t('admin.mod.working')
                          : t('admin.mod.restoreContent')}
                      </button>
                    ) : null}
                    <button
                      className="primary"
                      type="button"
                      disabled={report.status === 'RESOLVED' || report.status === 'REJECTED'}
                      onClick={() => openDecision(report)}
                    >
                      {t('admin.mod.review')}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {reportsCursor ? (
            <button className="btn-outline" type="button" disabled={reportsLoading} onClick={() => void loadReports(reportsCursor)}>
              {reportsLoading ? t('common.loading') : t('admin.mod.loadMoreReports')}
            </button>
          ) : null}
        </>
      ) : null}

      {mode === 'appeals' ? (
        <>
          <div className="filter-row" role="group" aria-label={t('admin.mod.appealFilterAria')}>
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
              <button className="text-link" type="button" style={{ marginLeft: 8 }} onClick={() => void loadAppeals()}>
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {appealsLoading && appeals.length === 0 ? (
            <p className="muted small">{t('admin.mod.loadingAppeals')}</p>
          ) : null}

          {!appealsLoading && !appealsError && appeals.length === 0 ? (
            <div className="empty card">
              <div className="empty-icon">
                <Icon name="check" />
              </div>
              <h2>{t('admin.mod.emptyAppealsTitle')}</h2>
              <p>{t('admin.mod.emptyAppealsCopy')}</p>
            </div>
          ) : null}

          <div className="stack">
            {appeals.map((appeal) => (
              <article className="card pad moderation-case" key={appeal.id}>
                <div className="moderation-case-head">
                  <div>
                    <div className="moderation-case-tags">
                      <span className="tag">{t(`admin.mod.status.${appeal.status}`)}</span>
                      <span className="tag">{t(`admin.mod.type.${appeal.targetType}`)}</span>
                    </div>
                    <h2>{appeal.target?.title ?? t('admin.mod.contentUnavailable')}</h2>
                    <p className="hint">
                      {appeal.appellantCharacterName ?? t('admin.mod.someone')} ·{' '}
                      {formatAdminDateTime(appeal.createdAt, language)}
                    </p>
                    <p className="moderation-reason">{appeal.message}</p>
                    {appeal.resolutionNote ? (
                      <p className="moderation-context">
                        {t('admin.mod.answer')}: {appeal.resolutionNote}
                      </p>
                    ) : null}
                  </div>
                  {appeal.status === 'PENDING' ? (
                    <div className="moderation-actions">
                      <button className="primary" type="button" onClick={() => openAppeal(appeal, 'ACCEPTED')}>
                        {t('admin.mod.accept')}
                      </button>
                      <button className="secondary" type="button" onClick={() => openAppeal(appeal, 'REJECTED')}>
                        {t('admin.mod.reject')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {appealsCursor ? (
            <button className="btn-outline" type="button" disabled={appealsLoading} onClick={() => void loadAppeals(appealsCursor)}>
              {appealsLoading ? t('common.loading') : t('admin.mod.loadMoreAppeals')}
            </button>
          ) : null}
        </>
      ) : null}

      {mode === 'history' ? (
        <>
          <div className="admin-filter-stack">
            <div className="filter-row" role="group" aria-label={t('admin.mod.historyFilterAria')}>
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
            <div className="filter-row" role="group" aria-label={t('admin.mod.actionFilterAria')}>
              {actionFilters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`filter-pill ${actionFilter === item.id ? 'active' : ''}`.trim()}
                  aria-pressed={actionFilter === item.id}
                  onClick={() => setActionFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {actionsError ? (
            <div className="auth-error" role="alert">
              {actionsError}
              <button className="text-link" type="button" style={{ marginLeft: 8 }} onClick={() => void loadActions()}>
                {t('common.retry')}
              </button>
            </div>
          ) : null}

          {actionsLoading && actions.length === 0 ? (
            <p className="muted small">{t('admin.mod.loadingHistory')}</p>
          ) : null}

          {!actionsLoading && !actionsError && actions.length === 0 ? (
            <div className="empty card">
              <div className="empty-icon">
                <Icon name="shield" />
              </div>
              <h2>{t('admin.mod.emptyHistoryTitle')}</h2>
              <p>{t('admin.mod.emptyHistoryCopy')}</p>
            </div>
          ) : null}

          <div className="stack">
            {actions.map((action) => (
              <article className="card pad moderation-audit" key={action.id}>
                <div className="row-between">
                  <div>
                    <div className="moderation-case-tags">
                      <span className="tag">{t(`admin.mod.action.${action.action}`)}</span>
                      {action.revertedAt ? <span className="status-pill draft">{t('admin.mod.revertedFilter')}</span> : null}
                    </div>
                    <h2>{action.target?.title ?? t('admin.mod.targetUnavailable')}</h2>
                    <p className="hint">
                      {action.actorCharacterName ?? t('admin.mod.staff')} ·{' '}
                      {formatAdminDateTime(action.createdAt, language)}
                    </p>
                    <p className="moderation-reason">
                      <b>{t('admin.mod.reason')}:</b> {action.reason}
                    </p>
                    {action.target?.context ? (
                      <p className="moderation-context">{action.target.context}</p>
                    ) : null}
                    {action.revertedAt ? (
                      <p className="moderation-context">
                        {t('admin.mod.revertedBy')} {action.revertedByCharacterName ?? t('admin.mod.staff')}{' '}
                        {formatAdminDateTime(action.revertedAt, language)}
                        {action.revertReason ? `: ${action.revertReason}` : ''}
                      </p>
                    ) : null}
                  </div>
                  {action.canRevert ? (
                    <button className="secondary" type="button" onClick={() => openRevert(action)}>
                      {t('admin.mod.revert')}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {actionsCursor ? (
            <button className="btn-outline" type="button" disabled={actionsLoading} onClick={() => void loadActions(actionsCursor)}>
              {actionsLoading ? t('common.loading') : t('admin.mod.loadMoreHistory')}
            </button>
          ) : null}
        </>
      ) : null}

      {decisionReport ? (
        <div className="modal-layer" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-decision-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submitDecision();
            }}
          >
            <div className="modal-head">
              <div>
                <h2 id="admin-decision-title">{t('admin.mod.review')}</h2>
                <p>{decisionReport.target?.title ?? t(`admin.mod.type.${decisionReport.reportedType}`)}</p>
              </div>
              <button
                className="close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setDecisionReport(null)}
              >
                <Icon name="x" />
              </button>
            </div>

            <div className="moderation-review-context">
              <p className="hint">
                {decisionReport.target?.authorName ?? t('admin.mod.authorUnavailable')} ·{' '}
                {t(`admin.mod.type.${decisionReport.reportedType}`)}
              </p>
              <p className="moderation-reason">
                <b>{t('admin.mod.reportReason')}:</b> {decisionReport.reason}
              </p>
              {decisionReport.target?.context ? (
                <p className="moderation-context">{decisionReport.target.context}</p>
              ) : null}
            </div>

            <label className="field-label" htmlFor="admin-decision-action">
              {t('admin.mod.decision')}
            </label>
            <select
              id="admin-decision-action"
              className="field"
              value={decisionAction}
              onChange={(event) => setDecisionAction(event.target.value as ModerationDecision)}
            >
              <option value="DISMISS">{t('admin.mod.decision.DISMISS')}</option>
              <option
                value="HIDE"
                disabled={
                  decisionReport.reportedType !== 'STORY' && decisionReport.reportedType !== 'COMMENT'
                }
              >
                {t('admin.mod.decision.HIDE')}
              </option>
              <option value="SUSPEND">{t('admin.mod.decision.SUSPEND')}</option>
            </select>

            <label className="field-label" htmlFor="admin-decision-reason">
              {t('admin.mod.reasonLabel')}
            </label>
            <textarea
              id="admin-decision-reason"
              className="field"
              minLength={5}
              maxLength={1000}
              required
              value={decisionReason}
              onChange={(event) => setDecisionReason(event.target.value)}
              placeholder={t('admin.mod.reasonPlaceholder')}
            />

            {decisionError ? (
              <p className="auth-error" role="alert">
                {decisionError}
              </p>
            ) : null}

            <div className="modal-actions">
              <button className="ghost" type="button" onClick={() => setDecisionReport(null)} disabled={decisionBusy}>
                {t('common.cancel')}
              </button>
              <button className="primary" type="submit" disabled={decisionBusy}>
                {decisionBusy ? t('admin.mod.applying') : t('admin.mod.applyDecision')}
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
            aria-labelledby="admin-revert-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submitRevert();
            }}
          >
            <div className="modal-head">
              <div>
                <h2 id="admin-revert-title">{t('admin.mod.revert')}</h2>
                <p>{revertTarget.target?.title ?? t('admin.mod.targetUnavailable')}</p>
              </div>
              <button
                className="close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setRevertTarget(null)}
              >
                <Icon name="x" />
              </button>
            </div>
            <p className="hint">{t('admin.mod.revertCopy')}</p>
            <label className="field-label" htmlFor="admin-revert-reason">
              {t('admin.mod.revertReasonLabel')}
            </label>
            <textarea
              id="admin-revert-reason"
              className="field"
              minLength={5}
              maxLength={1000}
              required
              value={revertReason}
              onChange={(event) => setRevertReason(event.target.value)}
              placeholder={t('admin.mod.revertReasonPlaceholder')}
            />
            {revertError ? (
              <p className="auth-error" role="alert">
                {revertError}
              </p>
            ) : null}
            <div className="modal-actions">
              <button className="ghost" type="button" onClick={() => setRevertTarget(null)} disabled={revertBusy}>
                {t('common.cancel')}
              </button>
              <button className="primary" type="submit" disabled={revertBusy}>
                {revertBusy ? t('admin.mod.working') : t('admin.mod.revert')}
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
            aria-labelledby="admin-appeal-title"
            onSubmit={(event) => {
              event.preventDefault();
              void submitAppeal();
            }}
          >
            <div className="modal-head">
              <div>
                <h2 id="admin-appeal-title">
                  {appealTarget.status === 'ACCEPTED' ? t('admin.mod.accept') : t('admin.mod.reject')}
                </h2>
                <p>{appealTarget.appeal.target?.title ?? t('admin.mod.contentUnavailable')}</p>
              </div>
              <button
                className="close"
                type="button"
                aria-label={t('common.close')}
                onClick={() => setAppealTarget(null)}
              >
                <Icon name="x" />
              </button>
            </div>
            <p className="hint">
              {appealTarget.status === 'ACCEPTED'
                ? t('admin.mod.acceptCopy')
                : t('admin.mod.rejectCopy')}
            </p>
            <label className="field-label" htmlFor="admin-appeal-note">
              {t('admin.mod.resolutionNote')}
            </label>
            <textarea
              id="admin-appeal-note"
              className="field"
              maxLength={1000}
              value={appealNote}
              onChange={(event) => setAppealNote(event.target.value)}
              placeholder={t('admin.mod.resolutionPlaceholder')}
            />
            {appealError ? (
              <p className="auth-error" role="alert">
                {appealError}
              </p>
            ) : null}
            <div className="modal-actions">
              <button className="ghost" type="button" onClick={() => setAppealTarget(null)} disabled={appealBusy}>
                {t('common.cancel')}
              </button>
              <button className="primary" type="submit" disabled={appealBusy}>
                {appealBusy
                  ? t('admin.mod.working')
                  : appealTarget.status === 'ACCEPTED'
                    ? t('admin.mod.accept')
                    : t('admin.mod.reject')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
