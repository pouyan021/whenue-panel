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
import { useI18n } from '../i18n/i18n';
import { CONSENT_PURPOSE } from '../lib/consents';
import { useFormat } from '../lib/format';
import { Mobile } from './members';
import { Button, Dialog, ErrorBanner, Loading, StatusBadge, Stars, VIDEO_LABEL } from './ui';

// Lists and the sidebar badge change with every decision.
const REFETCH = ['Testimonials', 'TestimonialCounts'];

export function TestimonialDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useI18n();
  // Always fetched afresh: the video's signed URLs only last a few minutes.
  const { data, loading, error, refetch } = useQuery(TESTIMONIAL, {
    variables: { id },
    fetchPolicy: 'network-only',
  });
  const testimonial = data?.testimonial;

  return (
    <Dialog
      title={testimonial ? t('testimonial.from', { name: testimonial.user.name }) : t('testimonial.title')}
      onClose={onClose}
      wide
    >
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
        !error && <p>{t('testimonial.gone')}</p>
      )}
    </Dialog>
  );
}

function Player({ testimonial: item, onExpired }: { testimonial: Testimonial; onExpired: () => void }) {
  const { t } = useI18n();
  const [retried, setRetried] = useState(false);
  const src = item.video?.playbackUrl ?? item.videoUrl;

  if (!src) {
    return (
      <div className="player player-empty">
        {item.video ? t(VIDEO_LABEL[item.video.status]) : t('video.none')}
        {item.video?.status === 'QUEUED' && <span className="muted small">{t('video.stillProcessing')}</span>}
        {item.video?.status === 'DELETED' && <span className="muted small">{t('video.deletedHint')}</span>}
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
      poster={item.video?.posterUrl ?? undefined}
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

function Details({ testimonial: item }: { testimonial: Testimonial }) {
  const { t } = useI18n();
  const format = useFormat();
  return (
    <dl className="details">
      <dt>{t('testimonial.status')}</dt>
      <dd>
        <StatusBadge status={item.status} />
      </dd>
      <dt>{t('testimonial.visitor')}</dt>
      <dd>
        {item.user.name}
        {item.user.phone && (
          <>
            <br />
            <Mobile value={item.user.phone} />
          </>
        )}
        {item.user.email && (
          <>
            <br />
            <a href={`mailto:${item.user.email}`} dir="ltr">
              {item.user.email}
            </a>
          </>
        )}
      </dd>
      <dt>{t('testimonial.submitted')}</dt>
      <dd>{format.dateTime(item.createdAt)}</dd>
      {item.visit && (
        <>
          <dt>{t('testimonial.visit')}</dt>
          <dd>{format.dateTime(item.visit.visitDate)}</dd>
        </>
      )}
      {item.campaign && (
        <>
          <dt>{t('testimonial.campaign')}</dt>
          <dd>{item.campaign.name}</dd>
        </>
      )}
      {item.rating != null && (
        <>
          <dt>{t('testimonial.rating')}</dt>
          <dd>
            <Stars rating={item.rating} />
          </dd>
        </>
      )}
      {item.text && (
        <>
          <dt>{t('testimonial.note')}</dt>
          <dd className="note">{item.text}</dd>
        </>
      )}
      <dt>{t('testimonial.publishableIn')}</dt>
      <dd>
        {item.publishableIn.length === 0
          ? t('testimonial.nowhere')
          : item.publishableIn.map((p) => t(CONSENT_PURPOSE[p])).join('، ')}
      </dd>
      {item.blurFace && (
        <>
          <dt>{t('testimonial.blurFace')}</dt>
          <dd>{t('testimonial.blurFaceAsked')}</dd>
        </>
      )}
    </dl>
  );
}

function Actions({ testimonial: item, onDeleted }: { testimonial: Testimonial; onDeleted: () => void }) {
  const { t } = useI18n();
  const [setStatus, status] = useMutation(UPDATE_TESTIMONIAL_STATUS, { refetchQueries: REFETCH });
  const [approveForUse, forUse] = useMutation(APPROVE_FOR_USE);
  const [remove, removal] = useMutation(DELETE_TESTIMONIAL, { refetchQueries: REFETCH });
  const busy = status.loading || forUse.loading || removal.loading;

  if (item.withdrawnAt) {
    return <p className="notice">{t('testimonial.withdrawnHint')}</p>;
  }

  function decide(next: TestimonialStatus) {
    void setStatus({ variables: { id: item.id, status: next } }).catch(() => undefined);
  }

  async function onDelete() {
    if (!window.confirm(t('testimonial.deleteConfirm', { name: item.user.name }))) return;
    const result = await remove({ variables: { id: item.id } }).catch(() => null);
    if (result?.data?.deleteTestimonial) onDeleted();
  }

  // The API refuses these too; saying why here saves a round trip.
  const blocker =
    item.status !== 'APPROVED'
      ? t('testimonial.approveFirst')
      : item.publishableIn.length === 0
        ? t('testimonial.noPublishConsent')
        : null;

  return (
    <div className="actions">
      <ErrorBanner error={status.error ?? forUse.error ?? removal.error} />
      <div className="action-row">
        {item.status !== 'APPROVED' && (
          <Button variant="primary" disabled={busy} onClick={() => decide('APPROVED')}>
            {t('testimonial.approve')}
          </Button>
        )}
        {item.status !== 'REJECTED' && (
          <Button variant="danger" disabled={busy} onClick={() => decide('REJECTED')}>
            {t('testimonial.reject')}
          </Button>
        )}
        {item.status !== 'PENDING' && (
          <Button disabled={busy} onClick={() => decide('PENDING')}>
            {t('testimonial.backToReview')}
          </Button>
        )}
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={item.approvedForUse}
          disabled={busy || (blocker != null && !item.approvedForUse)}
          onChange={(e) =>
            void approveForUse({
              variables: { id: item.id, approved: e.target.checked },
              optimisticResponse: {
                approveTestimonialForUse: { __typename: 'Testimonial', id: item.id, approvedForUse: e.target.checked },
              },
            }).catch(() => undefined)
          }
        />
        {t('testimonial.clearedForUse')}
        {blocker && <span className="muted small"> ({blocker})</span>}
      </label>
      <Button variant="ghost" className="delete" disabled={busy} onClick={onDelete}>
        {t('testimonial.delete')}
      </Button>
    </div>
  );
}
