import { useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { TestimonialDialog } from '../components/TestimonialDialog';
import { Button, Empty, ErrorBanner, Loading, StatusBadge, Stars, VIDEO_LABEL } from '../components/ui';
import { TESTIMONIAL_COUNTS, TESTIMONIALS, type Testimonial, type TestimonialStatus } from '../graphql/operations';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/i18n';
import { config } from '../lib/config';
import { useFormat } from '../lib/format';
import { useCurrentVenue } from '../lib/venue';

type Filter = TestimonialStatus | 'ALL';

const FILTERS: { value: Filter; label: MessageKey }[] = [
  { value: 'PENDING', label: 'testimonials.tab.review' },
  { value: 'APPROVED', label: 'testimonial.status.approved' },
  { value: 'REJECTED', label: 'testimonial.status.rejected' },
  { value: 'ALL', label: 'testimonials.tab.all' },
];

export function TestimonialsPage() {
  const { t } = useI18n();
  const format = useFormat();
  const { venue } = useCurrentVenue();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('status') as Filter | null) ?? 'PENDING';
  const openId = params.get('open');
  const [size, setSize] = useState(config.pageSize);

  const counts = useQuery(TESTIMONIAL_COUNTS, { variables: { venueId: venue.id } }).data?.testimonialCounts;
  const { data, loading, error } = useQuery(TESTIMONIALS, {
    variables: { venueId: venue.id, status: filter === 'ALL' ? null : filter, page: 0, size },
  });
  const testimonials = data?.testimonials ?? [];

  function setFilter(next: Filter) {
    setSize(config.pageSize);
    setParams({ status: next });
  }

  function open(id: string | null) {
    const next = new URLSearchParams(params);
    if (id) next.set('open', id);
    else next.delete('open');
    setParams(next);
  }

  function countOf(value: Filter) {
    if (!counts) return null;
    if (value === 'ALL') return counts.pending + counts.approved + counts.rejected;
    return counts[value.toLowerCase() as keyof typeof counts];
  }

  return (
    <section>
      <header className="page-header">
        <h1>{t('testimonials.title')}</h1>
      </header>

      <div className="tabs" role="tablist">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            className="tab"
            onClick={() => setFilter(value)}
          >
            {t(label)}
            {countOf(value) != null && <span className="tab-count">{format.number(countOf(value)!)}</span>}
          </button>
        ))}
      </div>

      <ErrorBanner error={error} />
      {loading && testimonials.length === 0 ? (
        <Loading />
      ) : testimonials.length === 0 ? (
        <Empty>{filter === 'PENDING' ? t('testimonials.caughtUp') : t('testimonials.empty')}</Empty>
      ) : (
        <ul className="testimonial-grid">
          {testimonials.map((t) => (
            <li key={t.id}>
              <TestimonialCard testimonial={t} onOpen={() => open(t.id)} />
            </li>
          ))}
        </ul>
      )}

      {testimonials.length === size && (
        <div className="more">
          <Button onClick={() => setSize(size + config.pageSize)} disabled={loading}>
            {t('common.showMore')}
          </Button>
        </div>
      )}

      {openId && <TestimonialDialog id={openId} onClose={() => open(null)} />}
    </section>
  );
}

function TestimonialCard({ testimonial: item, onOpen }: { testimonial: Testimonial; onOpen: () => void }) {
  const { t } = useI18n();
  const format = useFormat();
  const poster = item.video?.posterUrl;
  return (
    <button
      className="testimonial-card"
      onClick={onOpen}
      aria-label={t('testimonials.open', { name: item.user.name })}
    >
      <div className="poster">
        {poster ? (
          <img src={poster} alt="" loading="lazy" />
        ) : (
          <span className="poster-placeholder">
            {item.video ? t(VIDEO_LABEL[item.video.status]) : item.videoUrl ? t('video.video') : t('video.none')}
          </span>
        )}
        {item.video?.durationSeconds != null && (
          <span className="duration">{t('video.seconds', { seconds: format.number(Math.round(item.video.durationSeconds)) })}</span>
        )}
      </div>
      <div className="testimonial-meta">
        <div className="row">
          <strong>{item.user.name}</strong>
          <StatusBadge status={item.status} />
        </div>
        <div className="row muted small">
          <span>{format.dateTime(item.createdAt)}</span>
          <Stars rating={item.rating} />
        </div>
        {item.text && <p className="snippet">{item.text}</p>}
        {item.withdrawnAt ? (
          <span className="badge badge-rejected">{t('testimonial.withdrawn')}</span>
        ) : (
          item.approvedForUse && <span className="badge badge-use">{t('testimonial.cleared')}</span>
        )}
      </div>
    </button>
  );
}
