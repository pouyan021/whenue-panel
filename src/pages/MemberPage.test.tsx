import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { MEMBER, RECORD_MEMBER_CONSENTS, type ConsentInput } from '../graphql/operations';
import { config } from '../lib/config';
import { PAPER_CONSENT_VERSION, paperConsentText } from '../lib/consents';
import { orgAdmin, renderPage } from '../test/render';
import { MemberPage } from './MemberPage';

const member = {
  __typename: 'Member',
  id: '21',
  name: 'Sara Ahmadi',
  mobile: '+989121234567',
  memberSince: '2026-09-01T08:00:00Z',
  pointsBalance: 80,
  createdAt: '2026-09-01T08:00:00Z',
  email: null,
  consents: [
    {
      __typename: 'Consent',
      purpose: 'CLUB_MEMBERSHIP',
      granted: true,
      textVersion: 'membership-v1',
      method: 'MEMBER_APP',
      recordedAt: '2026-09-01T08:00:00Z',
    },
  ],
  consentHistory: [],
  pointEntries: [
    { __typename: 'PointEntry', id: '61', points: 50, kind: 'REFERRAL_FRIEND', note: null, createdAt: '2026-09-03T08:00:00Z' },
    { __typename: 'PointEntry', id: '62', points: 30, kind: 'SPEND', note: null, createdAt: '2026-09-03T08:00:00Z' },
  ],
  redemptions: [],
  referralCode: 'SARA21',
  referrals: { __typename: 'ReferralCounts', pending: 2, qualified: 1 },
};

const query = {
  request: { query: MEMBER, variables: { id: '21', size: config.pageSize } },
  result: { data: { member } },
  maxUsageCount: Number.POSITIVE_INFINITY,
};

function renderMember(mocks: Parameters<typeof renderPage>[1], me = orgAdmin) {
  return renderPage(
    <Routes>
      <Route path="/members/:id" element={<MemberPage />} />
    </Routes>,
    mocks,
    { path: '/members/21', me },
  );
}

describe('MemberPage', () => {
  it('shows points, referrals and consents', async () => {
    renderMember([query]);

    expect(await screen.findByRole('heading', { name: 'Sara Ahmadi' })).toBeInTheDocument();
    expect(screen.getByText('80 points')).toBeInTheDocument();
    expect(screen.getByText('SARA21')).toBeInTheDocument();
    expect(screen.getByText('1 qualified, 2 waiting for a first paid visit')).toBeInTheDocument();
    expect(screen.getByText('Joined through a friend')).toBeInTheDocument();
    const membership = screen.getByText('Club membership').closest('tr')!;
    expect(within(membership).getByText('Agreed')).toBeInTheDocument();
    expect(within(membership).getByText(/In the app/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Correct points' })).toBeInTheDocument();
  });

  it('records a paper consent with the wording the member signed', async () => {
    const user = userEvent.setup();
    const recorded = vi.fn();
    renderMember([
      query,
      {
        request: {
          query: RECORD_MEMBER_CONSENTS,
          variables: (vars: { memberId: string; consents: ConsentInput[] }) => {
            recorded(vars);
            return true;
          },
        },
        result: { data: { recordMemberConsents: [] } },
      },
    ]);

    await user.click(await screen.findByRole('button', { name: 'Enter paper consent' }));
    const dialog = await screen.findByRole('dialog', { name: 'Enter paper consent' });
    const sms = within(dialog).getByRole('group', { name: 'Offers by text message' });
    await user.click(within(sms).getByLabelText('Agreed'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await expect.poll(() => recorded.mock.calls.length).toBe(1);
    expect(recorded).toHaveBeenCalledWith({
      memberId: '21',
      consents: [
        {
          purpose: 'MARKETING_SMS',
          granted: true,
          textVersion: PAPER_CONSENT_VERSION,
          text: paperConsentText('MARKETING_SMS', 'Luna Clinic'),
        },
      ],
    });
  });

  it('asks before withdrawing recording consent, which deletes videos', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderMember([query]);

    await user.click(await screen.findByRole('button', { name: 'Enter paper consent' }));
    const dialog = await screen.findByRole('dialog', { name: 'Enter paper consent' });
    const recording = within(dialog).getByRole('group', { name: 'Recording a testimonial' });
    await user.click(within(recording).getByLabelText('Withdrew'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('deletes every testimonial video'));
    expect(screen.getByRole('dialog', { name: 'Enter paper consent' })).toBeInTheDocument();
  });
});
