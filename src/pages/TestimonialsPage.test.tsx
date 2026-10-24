import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  TESTIMONIAL,
  TESTIMONIAL_COUNTS,
  TESTIMONIALS,
  UPDATE_TESTIMONIAL_STATUS,
} from '../graphql/operations';
import { config } from '../lib/config';
import { renderPage } from '../test/render';
import { TestimonialsPage } from './TestimonialsPage';

const testimonial = {
  __typename: 'Testimonial',
  id: '11',
  status: 'PENDING',
  rating: 4,
  text: 'Lovely coffee and quick service',
  approvedForUse: false,
  createdAt: '2026-10-20T18:30:00Z',
  videoUrl: null,
  video: {
    __typename: 'Video',
    id: '5',
    status: 'READY',
    durationSeconds: 31.4,
    playbackUrl: 'https://s3.test/video.mp4?sig=1',
    posterUrl: 'https://s3.test/poster.jpg?sig=1',
  },
  user: { __typename: 'User', id: '7', name: 'Sam', email: 'sam@example.com' },
  visit: { __typename: 'Visit', id: '9', visitDate: '2026-10-20T17:00:00Z' },
  campaign: null,
};

const counts = {
  request: { query: TESTIMONIAL_COUNTS, variables: { venueId: '3' } },
  result: {
    data: { testimonialCounts: { __typename: 'TestimonialCounts', pending: 1, approved: 4, rejected: 2 } },
  },
  maxUsageCount: Number.POSITIVE_INFINITY,
};

const pendingList = {
  request: {
    query: TESTIMONIALS,
    variables: { venueId: '3', status: 'PENDING', page: 0, size: config.pageSize },
  },
  result: { data: { testimonials: [testimonial] } },
  maxUsageCount: Number.POSITIVE_INFINITY,
};

describe('TestimonialsPage', () => {
  it('lists testimonials to review with counts per status', async () => {
    renderPage(<TestimonialsPage />, [counts, pendingList], '/testimonials');

    expect(await screen.findByRole('button', { name: 'Open testimonial from Sam' })).toBeInTheDocument();
    expect(screen.getByText('Lovely coffee and quick service')).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /To review\s*1/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Approved\s*4/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /All\s*7/ })).toBeInTheDocument();
  });

  it('plays the video and approves the testimonial', async () => {
    const approve = {
      request: { query: UPDATE_TESTIMONIAL_STATUS, variables: { id: '11', status: 'APPROVED' } },
      result: {
        data: {
          updateTestimonialStatus: { __typename: 'Testimonial', id: '11', status: 'APPROVED', approvedForUse: false },
        },
      },
    };
    const detail = {
      request: { query: TESTIMONIAL, variables: { id: '11' } },
      result: { data: { testimonial } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    };
    const user = userEvent.setup();
    renderPage(<TestimonialsPage />, [counts, pendingList, detail, approve], '/testimonials');

    await user.click(await screen.findByRole('button', { name: 'Open testimonial from Sam' }));
    const dialog = await screen.findByRole('dialog', { name: 'Testimonial from Sam' });

    const video = await within(dialog).findByTestId('player');
    expect(video).toHaveAttribute('src', 'https://s3.test/video.mp4?sig=1');
    expect(within(dialog).getByRole('checkbox', { name: /Cleared for marketing use/ })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));

    expect(await within(dialog).findByRole('button', { name: 'Back to review' })).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: /Cleared for marketing use/ })).toBeEnabled();
  });
});
