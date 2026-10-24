import { useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { TestimonialDialog } from '../components/TestimonialDialog';
import { Button, Empty, ErrorBanner, Loading, StatusBadge, Stars, videoStatusLabel } from '../components/ui';
import { TESTIMONIAL_COUNTS, TESTIMONIALS, type Testimonial, type TestimonialStatus } from '../graphql/operations';
import { config } from '../lib/config';
import { formatDateTime } from '../lib/format';
import { useCurrentVenue } from '../lib/venue';

type Filter = TestimonialStatus | 'ALL';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'To review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
];

export function TestimonialsPage() {
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
        <h1>Testimonials</h1>
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
            {label}
            {countOf(value) != null && <span className="tab-count">{countOf(value)}</span>}
          </button>
        ))}
      </div>

      <ErrorBanner error={error} />
      {loading && testimonials.length === 0 ? (
        <Loading />
      ) : testimonials.length === 0 ? (
        <Empty>{filter === 'PENDING' ? 'Nothing to review. You are all caught up.' : 'No testimonials here yet.'}</Empty>
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
            Show more
          </Button>
        </div>
      )}

      {openId && <TestimonialDialog id={openId} onClose={() => open(null)} />}
    </section>
  );
}

function TestimonialCard({ testimonial: t, onOpen }: { testimonial: Testimonial; onOpen: () => void }) {
  const poster = t.video?.posterUrl;
  return (
    <button className="testimonial-card" onClick={onOpen} aria-label={`Open testimonial from ${t.user.name}`}>
      <div className="poster">
        {poster ? (
          <img src={poster} alt="" loading="lazy" />
        ) : (
          <span className="poster-placeholder">
            {t.video ? videoStatusLabel(t.video.status) : t.videoUrl ? 'Video' : 'No video'}
          </span>
        )}
        {t.video?.durationSeconds != null && (
          <span className="duration">{Math.round(t.video.durationSeconds)}s</span>
        )}
      </div>
      <div className="testimonial-meta">
        <div className="row">
          <strong>{t.user.name}</strong>
          <StatusBadge status={t.status} />
        </div>
        <div className="row muted small">
          <span>{formatDateTime(t.createdAt)}</span>
          <Stars rating={t.rating} />
        </div>
        {t.text && <p className="snippet">{t.text}</p>}
        {t.approvedForUse && <span className="badge badge-use">Cleared for marketing</span>}
      </div>
    </button>
  );
}
