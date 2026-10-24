import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

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
  if (!error) return null;
  return (
    <p role="alert" className="error-banner">
      {errorMessage(error)}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Loading() {
  return (
    <p className="muted" aria-live="polite">
      Loading…
    </p>
  );
}

const STATUS_LABEL: Record<TestimonialStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export function StatusBadge({ status }: { status: TestimonialStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}

const VIDEO_LABEL: Record<VideoStatus, string> = {
  UPLOADING: 'Uploading',
  UPLOADED: 'Uploaded',
  QUEUED: 'Processing',
  READY: 'Ready',
  FAILED: 'Processing failed',
};

export function videoStatusLabel(status: VideoStatus) {
  return VIDEO_LABEL[status];
}

export function Stars({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  return (
    <span className="stars" aria-label={`${rating} out of 5`}>
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
        <Button variant="ghost" aria-label="Close" onClick={onClose}>
          ✕
        </Button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
