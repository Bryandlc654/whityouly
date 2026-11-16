'use client';

import Icon from '@/components/wy/Icon';
import { useI18n } from '@/components/providers/I18nProvider';

export default function ContentActionDialog({
  title,
  description,
  confirmLabel,
  reason,
  onReason,
  onCancel,
  onConfirm,
  busy,
  error,
  danger = false,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  reason: string;
  onReason: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  error: string;
  danger?: boolean;
}) {
  const { t } = useI18n();
  const valid = reason.trim().length >= 5;

  return (
    <div className="modal-layer" role="presentation">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-content-action-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onConfirm();
        }}
      >
        <div className="modal-head">
          <div>
            <h2 id="admin-content-action-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            className="close"
            type="button"
            aria-label={t('common.close')}
            onClick={onCancel}
            disabled={busy}
          >
            <Icon name="x" />
          </button>
        </div>

        <label className="field-label" htmlFor="admin-content-reason">
          {t('admin.content.reasonLabel')}
        </label>
        <textarea
          id="admin-content-reason"
          className="field"
          minLength={5}
          maxLength={1000}
          required
          value={reason}
          onChange={(event) => onReason(event.target.value)}
          placeholder={t('admin.content.reasonPlaceholder')}
        />
        <p className="hint">{t('admin.content.reasonMin')}</p>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="modal-actions">
          <button className="ghost" type="button" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            className={danger ? 'secondary danger-button' : 'primary'}
            type="submit"
            disabled={busy || !valid}
          >
            {busy ? t('admin.content.working') : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
