import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useState } from 'react';

import { Button, Dialog, Empty, ErrorBanner, Field, Loading } from '../components/ui';
import {
  SEGMENT_PREVIEW,
  SEND_SMS_CAMPAIGN,
  SMS_CAMPAIGNS,
  type MemberSegment,
  type SegmentAudience,
  type SmsCampaign,
} from '../graphql/operations';
import type { MessageKey } from '../i18n/en';
import { useI18n, type Translate } from '../i18n/i18n';
import { useFormat } from '../lib/format';
import { parseWholeNumber } from '../lib/numbers';
import { smsSize } from '../lib/sms';
import { useCurrentVenue } from '../lib/venue';

const MAX_TEXT = 500;

/** The filters as typed: empty means no filter. */
type Draft = {
  audience: SegmentAudience;
  inactiveDays: string;
  joinedWithinDays: string;
  minPoints: string;
  neverRedeemed: boolean;
  text: string;
};

const EMPTY: Draft = {
  audience: 'MEMBERS',
  inactiveDays: '',
  joinedWithinDays: '',
  minPoints: '',
  neverRedeemed: false,
  text: '',
};

/** Ready-made segments that clinics use most. */
const PRESETS: {
  key: MessageKey;
  textKey: MessageKey | null;
  draft: Partial<Draft>;
}[] = [
  {
    key: 'sms.preset.winBack',
    textKey: 'sms.preset.winBackText',
    draft: { inactiveDays: '60' },
  },
  {
    key: 'sms.preset.rewardReady',
    textKey: 'sms.preset.rewardReadyText',
    draft: { minPoints: '400', neverRedeemed: true },
  },
  {
    key: 'sms.preset.welcome',
    textKey: 'sms.preset.welcomeText',
    draft: { joinedWithinDays: '30' },
  },
  {
    key: 'sms.preset.invite',
    textKey: null,
    draft: { audience: 'NOT_JOINED' },
  },
];

export function toSegment(draft: Draft): MemberSegment {
  if (draft.audience === 'NOT_JOINED') {
    return {
      audience: 'NOT_JOINED',
      inactiveDays: null,
      joinedWithinDays: null,
      minPoints: null,
      neverRedeemed: false,
    };
  }
  return {
    audience: 'MEMBERS',
    inactiveDays: parseWholeNumber(draft.inactiveDays) || null,
    joinedWithinDays: parseWholeNumber(draft.joinedWithinDays) || null,
    minPoints: parseWholeNumber(draft.minPoints) || null,
    neverRedeemed: draft.neverRedeemed,
  };
}

/** Owners text a segment of their members: win-back offers, rewards waiting, invitations. */
export function SmsPage() {
  const { t } = useI18n();
  const format = useFormat();
  const { organization } = useCurrentVenue();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const segment = useDebouncedSegment(toSegment(draft));
  const preview = useQuery(SEGMENT_PREVIEW, {
    variables: { organizationId: organization.id, segment },
  });
  const history = useQuery(SMS_CAMPAIGNS, {
    variables: { organizationId: organization.id },
  });
  const sending = history.data?.smsCampaigns.some((c) => c.status === 'SENDING') ?? false;
  const { startPolling, stopPolling } = history;
  useEffect(() => {
    if (sending) startPolling(2000);
    else stopPolling();
  }, [sending, startPolling, stopPolling]);

  const members = draft.audience === 'MEMBERS';
  const size = smsSize(members ? draft.text : '');
  const reachable = preview.data?.segmentPreview.reachable ?? 0;
  const textOk = !members || (draft.text.trim().length > 0 && draft.text.trim().length <= MAX_TEXT);
  const set = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>{t('sms.title')}</h1>
          <p className="muted page-sub">{t('sms.intro')}</p>
        </div>
      </header>

      <div className="sms-layout">
        <div className="card stack">
          <div>
            <h2>{t('sms.presets')}</h2>
            <div className="chips">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className="chip"
                  onClick={() =>
                    setDraft({
                      ...EMPTY,
                      ...preset.draft,
                      text: preset.textKey ? t(preset.textKey) : '',
                    })
                  }
                >
                  {t(preset.key)}
                </button>
              ))}
            </div>
          </div>

          <div className="segmented" role="group" aria-label={t('sms.audience')}>
            {(['MEMBERS', 'NOT_JOINED'] as const).map((audience) => (
              <button
                key={audience}
                type="button"
                aria-pressed={draft.audience === audience}
                onClick={() => set({ audience })}
              >
                {t(audience === 'MEMBERS' ? 'sms.audience.members' : 'sms.audience.notJoined')}
              </button>
            ))}
          </div>

          {members ? (
            <>
              <div className="sms-filters">
                <Field label={t('sms.filter.inactiveDays')} hint={t('sms.filter.inactiveDaysHint')}>
                  <input
                    inputMode="numeric"
                    value={draft.inactiveDays}
                    onChange={(e) => set({ inactiveDays: e.target.value })}
                  />
                </Field>
                <Field label={t('sms.filter.joinedWithinDays')}>
                  <input
                    inputMode="numeric"
                    value={draft.joinedWithinDays}
                    onChange={(e) => set({ joinedWithinDays: e.target.value })}
                  />
                </Field>
                <Field label={t('sms.filter.minPoints')}>
                  <input
                    inputMode="numeric"
                    value={draft.minPoints}
                    onChange={(e) => set({ minPoints: e.target.value })}
                  />
                </Field>
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.neverRedeemed}
                  onChange={(e) => set({ neverRedeemed: e.target.checked })}
                />
                {t('sms.filter.neverRedeemed')}
              </label>
              <Field label={t('sms.text')} hint={t('sms.textHint')}>
                <textarea
                  rows={4}
                  maxLength={MAX_TEXT}
                  value={draft.text}
                  onChange={(e) => set({ text: e.target.value })}
                />
              </Field>
              <p className="muted small" aria-live="polite">
                {t('sms.size', {
                  characters: format.number(draft.text.length),
                  parts: format.number(size.parts),
                })}
              </p>
            </>
          ) : (
            <p className="muted">{t('sms.notJoinedHint')}</p>
          )}
        </div>

        <div className="card stack sms-preview">
          <h2>{t('sms.preview')}</h2>
          <ErrorBanner error={preview.error} />
          {preview.data ? (
            <PreviewSummary preview={preview.data.segmentPreview} parts={members ? size.parts : 1} />
          ) : (
            preview.loading && <Loading />
          )}
          <Button
            variant="primary"
            disabled={reachable === 0 || !textOk || preview.loading}
            onClick={() => setConfirming(true)}
          >
            {t('sms.send', { count: format.number(reachable) })}
          </Button>
        </div>
      </div>

      <h2>{t('sms.history')}</h2>
      <ErrorBanner error={history.error} />
      {history.loading && !history.data ? (
        <Loading />
      ) : history.data?.smsCampaigns.length ? (
        <CampaignTable campaigns={history.data.smsCampaigns} />
      ) : (
        <Empty>{t('sms.historyEmpty')}</Empty>
      )}

      {confirming && (
        <ConfirmDialog
          segment={toSegment(draft)}
          text={members ? draft.text.trim() : null}
          count={reachable}
          onClose={() => setConfirming(false)}
          onSent={() => {
            setConfirming(false);
            setDraft(EMPTY);
          }}
        />
      )}
    </section>
  );
}

function PreviewSummary({
  preview,
  parts,
}: {
  preview: {
    matching: number;
    reachable: number;
    sample: { id: string; name: string | null }[];
  };
  parts: number;
}) {
  const { t } = useI18n();
  const format = useFormat();
  const left = preview.matching - preview.reachable;
  return (
    <>
      <div className="kpi">
        <span className="kpi-label">{t('sms.reachable')}</span>
        <span className="kpi-value">{format.number(preview.reachable)}</span>
        <span className="kpi-hint">{t('sms.matching', { matching: format.number(preview.matching) })}</span>
      </div>
      {left > 0 && <p className="muted small">{t('sms.leftOut', { count: format.number(left) })}</p>}
      {preview.reachable > 0 && (
        <p className="muted small">
          {t('sms.units', {
            units: format.number(preview.reachable * Math.max(parts, 1)),
          })}
        </p>
      )}
      {preview.sample.length > 0 && (
        <p className="small">
          {t('sms.sample')} {preview.sample.map((m) => m.name ?? '—').join('، ')}
          {preview.reachable > preview.sample.length && '…'}
        </p>
      )}
    </>
  );
}

function ConfirmDialog({
  segment,
  text,
  count,
  onClose,
  onSent,
}: {
  segment: MemberSegment;
  text: string | null;
  count: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useI18n();
  const format = useFormat();
  const { organization } = useCurrentVenue();
  const [send, { loading, error }] = useMutation(SEND_SMS_CAMPAIGN, {
    refetchQueries: ['SmsCampaigns', 'SegmentPreview'],
  });
  return (
    <Dialog title={t('sms.confirmTitle')} onClose={onClose}>
      <div className="stack">
        <p>{t('sms.confirm', { count: format.number(count) })}</p>
        {text && <blockquote className="sms-quote">{text}</blockquote>}
        <ErrorBanner error={error} />
        <div className="form-actions">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={loading}
            onClick={() =>
              void send({
                variables: { organizationId: organization.id, segment, text },
              })
                .then((r) => r.data && onSent())
                .catch(() => undefined)
            }
          >
            {t('sms.confirmSend')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function CampaignTable({ campaigns }: { campaigns: SmsCampaign[] }) {
  const { t } = useI18n();
  const format = useFormat();
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>{t('sms.col.date')}</th>
            <th>{t('sms.col.segment')}</th>
            <th>{t('sms.col.text')}</th>
            <th>{t('sms.col.recipients')}</th>
            <th>{t('sms.col.result')}</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td>{format.dateTime(c.createdAt)}</td>
              <td>{segmentLabel(c.segment, t, format.number)}</td>
              <td className="sms-text-cell">{c.text}</td>
              <td>{format.number(c.recipients)}</td>
              <td>
                {c.status === 'SENDING'
                  ? t('sms.sending', {
                      sent: format.number(c.sent + c.failed),
                      total: format.number(c.recipients),
                    })
                  : t('sms.result', { sent: format.number(c.sent) })}
                {c.failed > 0 && (
                  <div className="muted small">{t('sms.failed', { count: format.number(c.failed) })}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function segmentLabel(segment: MemberSegment, t: Translate, number: (n: number) => string) {
  if (segment.audience === 'NOT_JOINED') return t('sms.audience.notJoined');
  const parts: string[] = [];
  if (segment.inactiveDays) parts.push(t('sms.label.inactive', { days: number(segment.inactiveDays) }));
  if (segment.joinedWithinDays) parts.push(t('sms.label.joined', { days: number(segment.joinedWithinDays) }));
  if (segment.minPoints) parts.push(t('sms.label.points', { points: number(segment.minPoints) }));
  if (segment.neverRedeemed) parts.push(t('sms.label.neverRedeemed'));
  return parts.length ? parts.join('، ') : t('sms.label.allMembers');
}

/** Waits for typing to stop before asking the API again. */
function useDebouncedSegment(segment: MemberSegment) {
  const key = JSON.stringify(segment);
  const [debounced, setDebounced] = useState(segment);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(JSON.parse(key) as MemberSegment), 300);
    return () => clearTimeout(timer);
  }, [key]);
  return debounced;
}
