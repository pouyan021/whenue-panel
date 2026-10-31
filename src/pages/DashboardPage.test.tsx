import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CLUB_STATS, type ClubPeriod, type ClubStats } from '../graphql/operations';
import { orgAdmin, renderPage } from '../test/render';
import { DashboardPage, niceMax } from './DashboardPage';

const period = (p: Partial<ClubPeriod>): ClubPeriod => ({
  __typename: 'ClubPeriod',
  newMembers: 0,
  visits: 0,
  activeMembers: 0,
  returningMembers: 0,
  revenueRial: 0,
  pointsEarned: 0,
  pointsRedeemed: 0,
  redemptions: 0,
  referralsQualified: 0,
  ...p,
} as ClubPeriod);

const stats = (days: number, extra: Partial<ClubStats> = {}) => ({
  __typename: 'ClubStats',
  days,
  from: '2026-10-25',
  to: '2026-10-31',
  membersTotal: 120,
  current: period({ newMembers: 12, visits: 30, activeMembers: 20, returningMembers: 10, revenueRial: 250_000_000 }),
  previous: period({ newMembers: 8, visits: 40, activeMembers: 20, returningMembers: 8, revenueRial: 250_000_000 }),
  daily: [
    { __typename: 'ClubStatsDay', date: '2026-10-30', visits: 4, newMembers: 1, revenueRial: 10_000_000 },
    { __typename: 'ClubStatsDay', date: '2026-10-31', visits: 6, newMembers: 2, revenueRial: 30_000_000 },
  ],
  topRewards: [{ __typename: 'RewardStat', rewardId: '9', name: 'Free consultation', redemptions: 3, points: 450 }],
  ...extra,
});

const request = (days: number, result: object) => ({
  request: { query: CLUB_STATS, variables: { organizationId: '5', days } },
  result: { data: { clubStats: result } },
});

describe('DashboardPage', () => {
  it('shows the period with changes against the period before', async () => {
    renderPage(<DashboardPage />, [request(30, stats(30))], { me: orgAdmin, path: '/dashboard' });

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('50% up')).toBeInTheDocument(); // new members 8 -> 12
    expect(screen.getByText('25% down')).toBeInTheDocument(); // visits 40 -> 30
    expect(screen.getByText('no change')).toBeInTheDocument(); // revenue
    expect(screen.getByText('10 pts up')).toBeInTheDocument(); // returning 40% -> 50%
    expect(screen.getByText('25m Toman')).toBeInTheDocument();
    expect(screen.getByText('Free consultation')).toBeInTheDocument();
  });

  it('switches period and can show the days as a table', async () => {
    const user = userEvent.setup();
    renderPage(<DashboardPage />, [request(30, stats(30)), request(7, stats(7))], { me: orgAdmin, path: '/dashboard' });

    await user.click(await screen.findByRole('button', { name: '7 days' }));
    expect(await screen.findByText('Last 7 days, compared with the 7 days before')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('points a new club to check-in', async () => {
    renderPage(<DashboardPage />, [request(30, stats(30, { membersTotal: 0 }))], { me: orgAdmin, path: '/dashboard' });
    expect(await screen.findByRole('link', { name: 'Check-in' })).toBeInTheDocument();
  });
});

describe('niceMax', () => {
  it('rounds the axis up to a round number just above the data', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(8);
    expect(niceMax(13)).toBe(16);
    expect(niceMax(21)).toBe(24);
    expect(niceMax(42)).toBe(50);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(181_000_000)).toBe(200_000_000);
  });
});
