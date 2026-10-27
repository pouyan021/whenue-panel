import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/i18n';
import type { TestimonialStatus, VideoStatus } from '../graphql/operations';
import { errorMessage } from '../lib/format';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

export function Button({ variant = 'secondary', className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`btn btn-${variant} ${className ?? ''}`} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function ErrorBanner({ error }: { error: unknown }) {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <p role="alert" className="error-banner">
      {errorMessage(error, t)}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Loading() {
  const { t } = useI18n();
  return (
    <p className="muted" aria-live="polite">
      {t('common.loading')}
    </p>
  );
}

const STATUS_LABEL: Record<TestimonialStatus, MessageKey> = {
  PENDING: 'testimonial.status.pending',
  APPROVED: 'testimonial.status.approved',
  REJECTED: 'testimonial.status.rejected',
};

export function StatusBadge({ status }: { status: TestimonialStatus }) {
  const { t } = useI18n();
  return <span className={`badge badge-${status.toLowerCase()}`}>{t(STATUS_LABEL[status])}</span>;
}

export const VIDEO_LABEL: Record<VideoStatus, MessageKey> = {
  UPLOADING: 'video.uploading',
  UPLOADED: 'video.uploaded',
  QUEUED: 'video.processing',
  READY: 'video.ready',
  FAILED: 'video.failed',
  DELETED: 'video.deleted',
};

export function Stars({ rating }: { rating: number | null }) {
  const { t } = useI18n();
  if (rating == null) return null;
  return (
    <span className="stars" aria-label={t('testimonial.stars', { rating })}>
      {'★'.repeat(rating)}
      <span className="stars-off">{'★'.repeat(Math.max(0, 5 - rating))}</span>
    </span>
  );
}

/** A native <dialog>, open while mounted. Escape and the close button call onClose. */
export function Dialog({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-header">
        <h2>{title}</h2>
        <Button variant="ghost" aria-label={t('common.close')} onClick={onClose}>
          ✕
        </Button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}

/** A label and value, for the summary rows at the top of a page. */
export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'accent' }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

/** A secret shown once, with a copy button. */
export function OneTimeSecret({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  return (
    <div className="secret">
      <p className="secret-warning">{t('common.shownOnce')}</p>
      <Field label={label}>
        <input readOnly dir="ltr" value={value} onFocus={(e) => e.target.select()} />
      </Field>
      <div className="form-actions">
        <Button variant="primary" onClick={() => void navigator.clipboard?.writeText(value)}>
          {t('common.copy')}
        </Button>
      </div>
    </div>
  );
}
