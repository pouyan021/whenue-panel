import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';

import {
  APPROVE_FOR_USE,
  DELETE_TESTIMONIAL,
  TESTIMONIAL,
  UPDATE_TESTIMONIAL_STATUS,
  type Testimonial,
  type TestimonialStatus,
} from '../graphql/operations';
import { formatDateTime } from '../lib/format';
import { Button, Dialog, ErrorBanner, Loading, StatusBadge, Stars, videoStatusLabel } from './ui';

// Lists and the sidebar badge change with every decision.
const REFETCH = ['Testimonials', 'TestimonialCounts'];

export function TestimonialDialog({ id, onClose }: { id: string; onClose: () => void }) {
  // Always fetched afresh: the video's signed URLs only last a few minutes.
  const { data, loading, error, refetch } = useQuery(TESTIMONIAL, {
    variables: { id },
    fetchPolicy: 'network-only',
  });
  const testimonial = data?.testimonial;

  return (
    <Dialog title={testimonial ? `Testimonial from ${testimonial.user.name}` : 'Testimonial'} onClose={onClose} wide>
      <ErrorBanner error={error} />
      {loading && !testimonial ? (
        <Loading />
      ) : testimonial ? (
        <div className="testimonial-detail">
          <Player testimonial={testimonial} onExpired={() => void refetch()} />
          <div className="testimonial-side">
            <Details testimonial={testimonial} />
            <Actions testimonial={testimonial} onDeleted={onClose} />
          </div>
        </div>
      ) : (
        !error && <p>This testimonial no longer exists.</p>
      )}
    </Dialog>
  );
}

function Player({ testimonial: t, onExpired }: { testimonial: Testimonial; onExpired: () => void }) {
  const [retried, setRetried] = useState(false);
  const src = t.video?.playbackUrl ?? t.videoUrl;

  if (!src) {
    return (
      <div className="player player-empty">
        {t.video ? videoStatusLabel(t.video.status) : 'No video'}
        {t.video?.status === 'QUEUED' && <span className="muted small">The video is still being processed.</span>}
      </div>
    );
  }
  return (
    <video
      className="player"
      data-testid="player"
      controls
      playsInline
      preload="metadata"
      src={src}
      poster={t.video?.posterUrl ?? undefined}
      // A signed URL that expired while the dialog was open: ask for a new one, once.
      onError={() => {
        if (!retried) {
          setRetried(true);
          onExpired();
        }
      }}
    />
  );
}

function Details({ testimonial: t }: { testimonial: Testimonial }) {
  return (
    <dl className="details">
      <dt>Status</dt>
      <dd>
        <StatusBadge status={t.status} />
      </dd>
      <dt>Visitor</dt>
      <dd>
        {t.user.name}
        <br />
        <a href={`mailto:${t.user.email}`}>{t.user.email}</a>
      </dd>
      <dt>Submitted</dt>
      <dd>{formatDateTime(t.createdAt)}</dd>
      {t.visit && (
        <>
          <dt>Visit</dt>
          <dd>{formatDateTime(t.visit.visitDate)}</dd>
        </>
      )}
      {t.campaign && (
        <>
          <dt>Campaign</dt>
          <dd>{t.campaign.name}</dd>
        </>
      )}
      {t.rating != null && (
        <>
          <dt>Rating</dt>
          <dd>
            <Stars rating={t.rating} />
          </dd>
        </>
      )}
      {t.text && (
        <>
          <dt>Note</dt>
          <dd className="note">{t.text}</dd>
        </>
      )}
    </dl>
  );
}

function Actions({ testimonial: t, onDeleted }: { testimonial: Testimonial; onDeleted: () => void }) {
  const [setStatus, status] = useMutation(UPDATE_TESTIMONIAL_STATUS, { refetchQueries: REFETCH });
  const [approveForUse, forUse] = useMutation(APPROVE_FOR_USE);
  const [remove, removal] = useMutation(DELETE_TESTIMONIAL, { refetchQueries: REFETCH });
  const busy = status.loading || forUse.loading || removal.loading;

  function decide(next: TestimonialStatus) {
    void setStatus({ variables: { id: t.id, status: next } }).catch(() => undefined);
  }

  async function onDelete() {
    if (!window.confirm(`Delete the testimonial from ${t.user.name}? This cannot be undone.`)) return;
    const result = await remove({ variables: { id: t.id } }).catch(() => null);
    if (result?.data?.deleteTestimonial) onDeleted();
  }

  return (
    <div className="actions">
      <ErrorBanner error={status.error ?? forUse.error ?? removal.error} />
      <div className="action-row">
        {t.status !== 'APPROVED' && (
          <Button variant="primary" disabled={busy} onClick={() => decide('APPROVED')}>
            Approve
          </Button>
        )}
        {t.status !== 'REJECTED' && (
          <Button variant="danger" disabled={busy} onClick={() => decide('REJECTED')}>
            Reject
          </Button>
        )}
        {t.status !== 'PENDING' && (
          <Button disabled={busy} onClick={() => decide('PENDING')}>
            Back to review
          </Button>
        )}
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={t.approvedForUse}
          disabled={busy || t.status !== 'APPROVED'}
          onChange={(e) =>
            void approveForUse({
              variables: { id: t.id, approved: e.target.checked },
              optimisticResponse: {
                approveTestimonialForUse: { __typename: 'Testimonial', id: t.id, approvedForUse: e.target.checked },
              },
            }).catch(() => undefined)
          }
        />
        Cleared for marketing use
        {t.status !== 'APPROVED' && <span className="muted small"> (approve it first)</span>}
      </label>
      <Button variant="ghost" className="delete" disabled={busy} onClick={onDelete}>
        Delete testimonial
      </Button>
    </div>
  );
}
