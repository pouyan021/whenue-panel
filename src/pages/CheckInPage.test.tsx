import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CHECK_IN, LOYALTY, MEMBER, MEMBERS, REDEEM_REWARD } from '../graphql/operations';
import { renderPage } from '../test/render';
import { CheckInPage } from './CheckInPage';

const summary = {
  __typename: 'Member',
  id: '21',
  name: 'Sara Ahmadi',
  mobile: '+989121234567',
  memberSince: '2026-09-01T08:00:00Z',
  pointsBalance: 120,
  createdAt: '2026-09-01T08:00:00Z',
};

const detail = (pointsBalance: number) => ({
  ...summary,
  pointsBalance,
  email: null,
  consents: [],
  consentHistory: [],
  pointEntries: [],
  redemptions: [],
  referralCode: 'SARA21',
  referrals: { __typename: 'ReferralCounts', pending: 0, qualified: 1 },
});

const reward = {
  __typename: 'Reward',
  id: '31',
  name: 'Free skin check',
  description: null,
  pointsCost: 150,
  active: true,
};

const loyalty = {
  request: { query: LOYALTY, variables: { organizationId: '5', includeInactive: false } },
  result: {
    data: {
      organization: {
        __typename: 'Organization',
        id: '5',
        loyaltyProgram: {
          __typename: 'LoyaltyProgram',
          pointsPerVisit: 10,
          spendUnitRial: 1000000,
          pointsPerSpendUnit: 1,
          referrerPoints: 100,
          friendPoints: 50,
          testimonialPoints: 20,
        },
        rewards: [reward],
      },
    },
  },
  maxUsageCount: Number.POSITIVE_INFINITY,
};

const member = (balance: number) => ({
  request: { query: MEMBER, variables: { id: '21', size: 5 } },
  result: { data: { member: detail(balance) } },
});

const search = (pointsBalance: number) => ({
  request: { query: MEMBERS, variables: { organizationId: '5', search: '0912', page: 0, size: 8 } },
  result: { data: { members: [{ ...summary, pointsBalance }] } },
});

describe('CheckInPage', () => {
  it('finds a member, records a visit in Toman and hands over a reward', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage(
      <CheckInPage />,
      [
        // The search stays open beside the member, so it is asked again after each change.
        search(120),
        member(120),
        loyalty,
        {
          // 2,000,000 Toman is 20,000,000 Rial.
          request: {
            query: CHECK_IN,
            variables: { input: { venueId: '3', memberId: '21', amountRial: 20000000 } },
          },
          result: {
            data: {
              checkIn: {
                __typename: 'CheckInResult',
                visit: { __typename: 'Visit', id: '41', visitDate: '2026-10-27T12:00:00Z', amountRial: 20000000 },
                pointsEarned: 30,
                balance: 150,
              },
            },
          },
        },
        member(150),
        search(150),
        {
          request: { query: REDEEM_REWARD, variables: { input: { venueId: '3', memberId: '21', rewardId: '31' } } },
          result: {
            data: {
              redeemReward: {
                __typename: 'Redemption',
                id: '51',
                points: 150,
                status: 'REDEEMED',
                createdAt: '2026-10-27T12:01:00Z',
                cancelledAt: null,
                reward: { __typename: 'Reward', id: '31', name: 'Free skin check' },
              },
            },
          },
        },
        member(0),
        search(0),
      ],
      '/check-in',
    );

    await user.type(screen.getByLabelText(/Find a member/), '0912');
    await user.click(await screen.findByRole('button', { name: /Sara Ahmadi/ }));

    expect(await screen.findByRole('heading', { name: 'Sara Ahmadi' })).toBeInTheDocument();
    expect(screen.getByText('120 points')).toBeInTheDocument();
    const rewardRow = (await screen.findByText('Free skin check')).closest('li')!;
    expect(within(rewardRow).getByText(/30 points short/)).toBeInTheDocument();
    expect(within(rewardRow).getByRole('button', { name: 'Hand over' })).toBeDisabled();

    await user.type(screen.getByLabelText(/Amount paid/), '۲٬۰۰۰٬۰۰۰');
    expect(screen.getByText('2,000,000 Toman')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Record visit' }));
    expect(await screen.findByRole('status')).toHaveTextContent('30 points earned; balance is now 150 points');

    const handOver = within(rewardRow).getByRole('button', { name: 'Hand over' });
    await waitFor(() => expect(handOver).toBeEnabled());
    await user.click(handOver);
    expect(window.confirm).toHaveBeenCalledWith('Hand “Free skin check” to Sara Ahmadi for 150 points?');
    expect(await screen.findByText('“Free skin check” handed over for 150 points.')).toBeInTheDocument();
  });

  it('opens a member straight from a scanned club card', async () => {
    const user = userEvent.setup();
    renderPage(<CheckInPage />, [member(120), loyalty], '/check-in');

    await user.type(screen.getByLabelText(/Find a member/), 'whenue://member/21{Enter}');

    expect(await screen.findByRole('heading', { name: 'Sara Ahmadi' })).toBeInTheDocument();
  });

  it('shows Persian digits, Toman and Solar Hijri dates in Persian', async () => {
    renderPage(<CheckInPage />, [member(120), loyalty], { path: '/check-in?member=21', lang: 'fa' });

    expect(await screen.findByText('۱۲۰ امتیاز')).toBeInTheDocument();
    // 1 September 2026 is 10 Shahrivar 1405.
    expect(screen.getByText('۱۰ شهریور ۱۴۰۵')).toBeInTheDocument();
    expect(screen.getByText('۰۹۱۲ ۱۲۳ ۴۵۶۷')).toBeInTheDocument();
  });
});
