import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SEGMENT_PREVIEW, SEND_SMS_CAMPAIGN, SMS_CAMPAIGNS, type MemberSegment } from '../graphql/operations';
import { en } from '../i18n/en';
import { orgAdmin, renderPage } from '../test/render';
import { SmsPage, toSegment } from './SmsPage';

const ALL: MemberSegment = { audience: 'MEMBERS', inactiveDays: null, joinedWithinDays: null, minPoints: null, neverRedeemed: false };
const WIN_BACK: MemberSegment = { ...ALL, inactiveDays: 60 };

const preview = (segment: MemberSegment, matching: number, reachable: number) => ({
  request: { query: SEGMENT_PREVIEW, variables: { organizationId: '5', segment } },
  result: {
    data: {
      segmentPreview: {
        __typename: 'SegmentPreview',
        matching,
        reachable,
        sample: [{ __typename: 'Member', id: '1', name: 'Sara Ahmadi' }],
      },
    },
  },
});

const campaign = {
  __typename: 'SmsCampaign',
  id: '7',
  text: en['sms.preset.winBackText'],
  segment: { __typename: 'MemberSegment', ...WIN_BACK },
  recipients: 40,
  sent: 0,
  failed: 0,
  status: 'SENDING',
  createdAt: '2026-11-01T08:00:00Z',
  finishedAt: null,
};

const history = (campaigns: object[]) => ({
  request: { query: SMS_CAMPAIGNS, variables: { organizationId: '5' } },
  result: { data: { smsCampaigns: campaigns } },
});

describe('toSegment', () => {
  it('drops empty and zero filters, and every filter for people who have not joined', () => {
    const draft = { audience: 'MEMBERS' as const, inactiveDays: '۶۰', joinedWithinDays: '', minPoints: '0', neverRedeemed: true, text: '' };
    expect(toSegment(draft)).toEqual({ ...ALL, inactiveDays: 60, neverRedeemed: true });
    expect(toSegment({ ...draft, audience: 'NOT_JOINED' })).toEqual({ ...ALL, audience: 'NOT_JOINED' });
  });
});

describe('SmsPage', () => {
  it('previews a preset segment and sends it after confirming', async () => {
    const user = userEvent.setup();
    renderPage(
      <SmsPage />,
      [
        preview(ALL, 100, 70),
        history([]),
        preview(WIN_BACK, 50, 40),
        {
          request: {
            query: SEND_SMS_CAMPAIGN,
            variables: { organizationId: '5', segment: WIN_BACK, text: en['sms.preset.winBackText'] },
          },
          result: { data: { sendSmsCampaign: campaign } },
        },
        history([campaign]),
        preview(ALL, 100, 30),
      ],
      { me: orgAdmin, path: '/sms' },
    );

    expect(await screen.findByText('70')).toBeInTheDocument();
    expect(screen.getByText('No campaigns yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: en['sms.preset.winBack'] }));
    expect(await screen.findByText('40')).toBeInTheDocument();
    expect(screen.getByText('50 match the filters')).toBeInTheDocument();
    expect(screen.getByText(/10 left out/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send to 40' }));
    expect(screen.getByText(/40 people will get this SMS/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send now' }));

    expect(await screen.findByText('Sending… 0 of 40')).toBeInTheDocument();
    expect(screen.getByText('no visit in 60 days')).toBeInTheDocument();
  });
});
