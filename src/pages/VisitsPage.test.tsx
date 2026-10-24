import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CAMPAIGNS, CREATE_VISIT, ISSUE_VISIT_TOKEN, VISITS, type CreateVisitInput } from '../graphql/operations';
import { config } from '../lib/config';
import { renderPage } from '../test/render';
import { VisitsPage } from './VisitsPage';

const visit = {
  __typename: 'Visit',
  id: '42',
  visitDate: '2026-10-24T12:00:00.000Z',
  notificationSent: false,
  user: { __typename: 'User', id: '7', name: 'Sam', email: 'sam@example.com', phone: null },
  campaign: null,
  testimonial: null,
};

const visits = (list: object[]) => ({
  request: { query: VISITS, variables: { venueId: '3', page: 0, size: config.pageSize } },
  result: { data: { visits: list } },
});

describe('VisitsPage', () => {
  it('adds a visit and hands out the visitor link', async () => {
    const user = userEvent.setup();
    renderPage(
      <VisitsPage />,
      [
        visits([]),
        {
          request: { query: CAMPAIGNS, variables: { venueId: '3', active: true, size: 100 } },
          result: { data: { campaigns: [] } },
        },
        {
          request: {
            query: CREATE_VISIT,
            // The visit time defaults to now, so only the visitor is checked.
            variables: ({ input }: { input: CreateVisitInput }) =>
              JSON.stringify(input.visitor) === JSON.stringify({ name: 'Sam', email: 'sam@example.com', phone: null }),
          },
          result: { data: { createVisit: visit } },
        },
        visits([visit]),
        {
          request: { query: ISSUE_VISIT_TOKEN, variables: { visitId: '42' } },
          result: {
            data: { issueVisitToken: { __typename: 'VisitToken', token: 'tok123', expiresAt: '2026-10-27T12:00:00Z' } },
          },
          maxUsageCount: 2,
        },
      ],
    );

    expect(await screen.findByText('No visits yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New visit' }));
    const form = await screen.findByRole('dialog', { name: 'New visit' });
    await user.type(within(form).getByLabelText('Visitor name'), 'Sam');
    await user.type(within(form).getByLabelText(/^Email/), 'sam@example.com');
    await user.click(within(form).getByRole('button', { name: 'Add visit' }));

    const linkDialog = await screen.findByRole('dialog', { name: 'Link for Sam' });
    expect(await within(linkDialog).findByDisplayValue('whenue://visit/tok123')).toBeInTheDocument();
    expect(within(linkDialog).getByRole('link', { name: 'Email it' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:sam@example.com'),
    );
  });
});
