import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CREATE_STAFF_ACCOUNT, STAFF_ACCOUNTS, UPDATE_STAFF_ACCOUNT, VENUES } from '../graphql/operations';
import { orgAdmin, organization, renderPage } from '../test/render';
import { StaffPage } from './StaffPage';

const owner = {
  __typename: 'StaffAccount',
  id: '2',
  email: 'owner@luna.test',
  role: 'ORG_ADMIN',
  enabled: true,
  venue: null,
  createdAt: '2026-10-01T08:00:00Z',
};
const desk = {
  __typename: 'StaffAccount',
  id: '7',
  email: 'desk@luna.test',
  role: 'VENUE_STAFF',
  enabled: true,
  venue: { __typename: 'Venue', id: '3', name: 'Luna Vanak' },
  createdAt: '2026-10-02T08:00:00Z',
};

const list = {
  request: { query: STAFF_ACCOUNTS, variables: { organizationId: '5' } },
  result: { data: { staffAccounts: [owner, desk] } },
  maxUsageCount: Number.POSITIVE_INFINITY,
};
const venues = {
  request: { query: VENUES, variables: { size: 200 } },
  result: {
    data: {
      venues: [
        {
          __typename: 'Venue',
          id: '3',
          name: 'Luna Vanak',
          organization: {
            __typename: 'Organization',
            ...organization,
            modules: organization.modules.map((m) => ({ __typename: 'OrganizationModule', ...m })),
          },
        },
      ],
    },
  },
  maxUsageCount: Number.POSITIVE_INFINITY,
};

describe('StaffPage', () => {
  it('lists the clinic’s accounts and leaves the owner’s own account alone', async () => {
    renderPage(<StaffPage />, [list], { me: orgAdmin });

    const ownerRow = (await screen.findByText('owner@luna.test')).closest('tr')!;
    expect(within(ownerRow).getByText('(you)')).toBeInTheDocument();
    expect(within(ownerRow).queryByRole('button')).toBeNull();
    const deskRow = screen.getByText('desk@luna.test').closest('tr')!;
    expect(within(deskRow).getByText('Reception')).toBeInTheDocument();
    expect(within(deskRow).getByText('Luna Vanak')).toBeInTheDocument();
    expect(within(deskRow).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('switches an account off after asking', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const saved = vi.fn(() => ({ data: { updateStaffAccount: { ...desk, enabled: false } } }));
    renderPage(
      <StaffPage />,
      [
        list,
        venues,
        {
          request: {
            query: UPDATE_STAFF_ACCOUNT,
            variables: { id: '7', input: { role: 'VENUE_STAFF', enabled: false, venueId: '3' } },
          },
          result: saved,
        },
      ],
      { me: orgAdmin },
    );

    const deskRow = (await screen.findByText('desk@luna.test')).closest('tr')!;
    await user.click(within(deskRow).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('Can sign in'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(saved).toHaveBeenCalled());
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('desk@luna.test'));
  });

  it('adds reception and shows the sign-in details once', async () => {
    const user = userEvent.setup();
    const created = vi.fn(() => ({
      data: { createStaffAccount: { ...desk, id: '8', email: 'new@luna.test' } },
    }));
    renderPage(
      <StaffPage />,
      [
        list,
        venues,
        {
          request: {
            query: CREATE_STAFF_ACCOUNT,
            variables: ({ input }: { input: Record<string, unknown> }) =>
              input.email === 'new@luna.test' &&
              input.role === 'VENUE_STAFF' &&
              input.venueId === '3' &&
              input.organizationId === null &&
              typeof input.password === 'string' &&
              input.password.length >= 12,
          },
          result: created,
        },
      ],
      { me: orgAdmin },
    );

    await user.click(await screen.findByRole('button', { name: 'Add staff' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Email'), 'new@luna.test');
    await user.click(within(dialog).getByRole('button', { name: 'Create account' }));
    expect(await within(dialog).findByText(/not shown again/)).toBeInTheDocument();
    expect(within(dialog).getByText('new@luna.test')).toBeInTheDocument();
    expect(created).toHaveBeenCalled();
  });
});
