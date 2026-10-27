import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';

import { MemberStatus, Mobile, memberName } from '../components/members';
import { Button, Dialog, Empty, ErrorBanner, Field, Loading, Stat } from '../components/ui';
import {
  ADJUST_POINTS,
  CANCEL_REDEMPTION,
  MEMBER,
  RECORD_MEMBER_CONSENTS,
  type Consent,
  type ConsentPurpose,
  type MemberDetail,
  type PointKind,
  type Redemption,
} from '../graphql/operations';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/i18n';
import { config } from '../lib/config';
import {
  CONSENT_PURPOSE,
  CONSENT_PURPOSES,
  PAPER_CONSENT_VERSION,
  paperConsentText,
  TESTIMONIAL_PURPOSES,
} from '../lib/consents';
import { useFormat } from '../lib/format';
import { toLatinDigits } from '../lib/numbers';
import { useCurrentVenue } from '../lib/venue';

const REFETCH = ['Member', 'Members'];

export const POINT_KIND: Record<PointKind, MessageKey> = {
  VISIT: 'points.kind.visit',
  SPEND: 'points.kind.spend',
  REFERRAL_REFERRER: 'points.kind.referrer',
  REFERRAL_FRIEND: 'points.kind.friend',
  TESTIMONIAL: 'points.kind.testimonial',
  REDEMPTION: 'points.kind.redemption',
  REDEMPTION_CANCELLED: 'points.kind.redemptionCancelled',
  ADJUSTMENT: 'points.kind.adjustment',
};

const CONSENT_METHOD: Record<Consent['method'], MessageKey> = {
  MEMBER_APP: 'consent.method.app',
  STAFF_RECORDED: 'consent.method.staff',
  VISIT_LINK: 'consent.method.visitLink',
};

export function MemberPage() {
  const { t } = useI18n();
  const { id = '' } = useParams();
  const [size, setSize] = useState(config.pageSize);
  const { data, loading, error } = useQuery(MEMBER, { variables: { id, size } });
  const member = data?.member;

  return (
    <section>
      <p>
        <Link to="/members">{t('member.back')}</Link>
      </p>
      <ErrorBanner error={error} />
      {loading && !member ? (
        <Loading />
      ) : !member ? (
        !error && <Empty>{t('member.notFound')}</Empty>
      ) : (
        <MemberDetails member={member} size={size} onMore={() => setSize(size + config.pageSize)} loading={loading} />
      )}
    </section>
  );
}

function MemberDetails({
  member,
  size,
  onMore,
  loading,
}: {
  member: MemberDetail;
  size: number;
  onMore: () => void;
  loading: boolean;
}) {
  const { t } = useI18n();
  const format = useFormat();
  const { canManage, hasModule } = useCurrentVenue();
  const [adjusting, setAdjusting] = useState(false);
  const [recording, setRecording] = useState(false);
  const more = member.pointEntries.length === size || member.redemptions.length === size;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{memberName(member, t('member.noName'))}</h1>
          <Mobile value={member.mobile} />
          {member.email && (
            <span className="muted" dir="ltr">
              {' · '}
              {member.email}
            </span>
          )}
        </div>
        <div className="action-row">
          <MemberStatus member={member} />
          {member.memberSince && (
            <Link className="btn btn-primary" to={`/check-in?member=${member.id}`}>
              {t('member.checkIn')}
            </Link>
          )}
        </div>
      </header>

      <div className="stats">
        <Stat label={t('member.balance')} value={format.points(member.pointsBalance)} tone="accent" />
        <Stat
          label={member.memberSince ? t('member.since') : t('member.invitedOn')}
          value={format.date(member.memberSince ?? member.createdAt)}
        />
        {hasModule('REFERRALS') && member.referralCode && (
          <Stat label={t('member.referralCode')} value={<span dir="ltr">{member.referralCode}</span>} />
        )}
        {hasModule('REFERRALS') && (
          <Stat
            label={t('member.referrals')}
            value={t('member.referralCounts', {
              qualified: format.number(member.referrals.qualified),
              pending: format.number(member.referrals.pending),
            })}
          />
        )}
      </div>

      <div className="two-columns">
        <div className="card">
          <div className="row">
            <h2>{t('points.history')}</h2>
            {canManage && <Button onClick={() => setAdjusting(true)}>{t('points.adjust')}</Button>}
          </div>
          {member.pointEntries.length === 0 ? (
            <p className="muted">{t('points.none')}</p>
          ) : (
            <table className="table table-plain">
              <tbody>
                {member.pointEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {t(POINT_KIND[entry.kind])}
                      {entry.note && <div className="muted small">{entry.note}</div>}
                    </td>
                    <td className={entry.points < 0 ? 'negative' : 'positive'} dir="ltr">
                      {entry.points > 0 ? '+' : ''}
                      {format.number(entry.points)}
                    </td>
                    <td className="muted small">{format.dateTime(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>{t('redemptions.title')}</h2>
          {member.redemptions.length === 0 ? (
            <p className="muted">{t('redemptions.none')}</p>
          ) : (
            <table className="table table-plain">
              <tbody>
                {member.redemptions.map((r) => (
                  <RedemptionRow key={r.id} redemption={r} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {more && (
        <div className="more">
          <Button onClick={onMore} disabled={loading}>
            {t('common.showMore')}
          </Button>
        </div>
      )}

      <div className="card">
        <div className="row">
          <h2>{t('consent.title')}</h2>
          <Button onClick={() => setRecording(true)}>{t('consent.recordPaper')}</Button>
        </div>
        <ConsentTable member={member} />
        {member.consentHistory.length > 0 && (
          <details className="history">
            <summary>{t('consent.history')}</summary>
            <ul>
              {member.consentHistory.map((c, i) => (
                <li key={i}>
                  {format.dateTime(c.recordedAt)}: {t(CONSENT_PURPOSE[c.purpose])},{' '}
                  {c.granted ? t('consent.granted') : t('consent.withdrawn')} ({t(CONSENT_METHOD[c.method])},{' '}
                  <span dir="ltr">{c.textVersion}</span>)
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {adjusting && <AdjustDialog member={member} onClose={() => setAdjusting(false)} />}
      {recording && <PaperConsentDialog member={member} onClose={() => setRecording(false)} />}
    </>
  );
}

function RedemptionRow({ redemption: r }: { redemption: Redemption }) {
  const { t } = useI18n();
  const format = useFormat();
  const [cancel, { loading, error }] = useMutation(CANCEL_REDEMPTION, { refetchQueries: REFETCH });

  function onCancel() {
    if (!window.confirm(t('redemptions.cancelConfirm', { reward: r.reward.name, points: format.points(r.points) }))) return;
    void cancel({ variables: { id: r.id } }).catch(() => undefined);
  }

  return (
    <tr>
      <td>
        {r.reward.name}
        <div className="muted small">{format.dateTime(r.createdAt)}</div>
        <ErrorBanner error={error} />
      </td>
      <td>{format.points(r.points)}</td>
      <td className="row-actions">
        {r.status === 'CANCELLED' ? (
          <span className="badge badge-muted">{t('redemptions.cancelled')}</span>
        ) : (
          <Button variant="ghost" disabled={loading} onClick={onCancel}>
            {t('redemptions.cancel')}
          </Button>
        )}
      </td>
    </tr>
  );
}

function ConsentTable({ member }: { member: MemberDetail }) {
  const { t } = useI18n();
  const format = useFormat();
  const { hasModule } = useCurrentVenue();
  const purposes = CONSENT_PURPOSES.filter((p) => hasModule('TESTIMONIALS') || !TESTIMONIAL_PURPOSES.includes(p));
  return (
    <table className="table table-plain">
      <tbody>
        {purposes.map((purpose) => {
          const consent = member.consents.find((c) => c.purpose === purpose);
          return (
            <tr key={purpose}>
              <td>{t(CONSENT_PURPOSE[purpose])}</td>
              <td>
                {!consent ? (
                  <span className="muted">{t('consent.notAsked')}</span>
                ) : consent.granted ? (
                  <span className="badge badge-approved">{t('consent.granted')}</span>
                ) : (
                  <span className="badge badge-rejected">{t('consent.withdrawn')}</span>
                )}
              </td>
              <td className="muted small">
                {consent && (
                  <>
                    {t(CONSENT_METHOD[consent.method])} · {format.date(consent.recordedAt)}
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AdjustDialog({ member, onClose }: { member: MemberDetail; onClose: () => void }) {
  const { t } = useI18n();
  const [adjust, { loading, error }] = useMutation(ADJUST_POINTS, { refetchQueries: REFETCH });
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const value = Number(toLatinDigits(points.trim()));
  const invalid = points.trim() !== '' && (!Number.isInteger(value) || value === 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (invalid) return;
    const result = await adjust({ variables: { memberId: member.id, points: value, note: note.trim() } }).catch(() => null);
    if (result?.data) onClose();
  }

  return (
    <Dialog title={t('points.adjust')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label={t('points.adjustAmount')} hint={invalid ? t('points.adjustInvalid') : t('points.adjustHint')}>
          <input required dir="ltr" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} aria-invalid={invalid} />
        </Field>
        <Field label={t('points.adjustNote')}>
          <input required value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <ErrorBanner error={error} />
        <div className="form-actions">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={loading || invalid}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

type Answer = 'keep' | 'grant' | 'withdraw';

/** Consents the member gave or withdrew on the clinic's paper form, entered by staff. */
function PaperConsentDialog({ member, onClose }: { member: MemberDetail; onClose: () => void }) {
  const { t } = useI18n();
  const { organization, hasModule } = useCurrentVenue();
  const [record, { loading, error }] = useMutation(RECORD_MEMBER_CONSENTS, { refetchQueries: REFETCH });
  const purposes = CONSENT_PURPOSES.filter((p) => hasModule('TESTIMONIALS') || !TESTIMONIAL_PURPOSES.includes(p));
  const [answers, setAnswers] = useState<Partial<Record<ConsentPurpose, Answer>>>({});
  const chosen = purposes.filter((p) => answers[p] && answers[p] !== 'keep');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (chosen.length === 0) return;
    const withdrawing = chosen.filter((p) => answers[p] === 'withdraw');
    if (withdrawing.includes('CLUB_MEMBERSHIP') && !window.confirm(t('consent.leaveConfirm'))) return;
    if (withdrawing.includes('TESTIMONIAL_RECORDING') && !window.confirm(t('consent.deleteVideosConfirm'))) return;
    const consents = chosen.map((purpose) => ({
      purpose,
      granted: answers[purpose] === 'grant',
      textVersion: PAPER_CONSENT_VERSION,
      text: paperConsentText(purpose, organization.name),
    }));
    const result = await record({ variables: { memberId: member.id, consents } }).catch(() => null);
    if (result?.data) onClose();
  }

  return (
    <Dialog title={t('consent.recordPaper')} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <p className="muted">{t('consent.paperIntro')}</p>
        {purposes.map((purpose) => (
          <fieldset key={purpose} className="consent-choice">
            <legend>{t(CONSENT_PURPOSE[purpose])}</legend>
            <p className="consent-text" lang="fa" dir="rtl">
              {paperConsentText(purpose, organization.name)}
            </p>
            <div className="action-row">
              {(['keep', 'grant', 'withdraw'] as const).map((answer) => (
                <label key={answer} className="checkbox">
                  <input
                    type="radio"
                    name={purpose}
                    checked={(answers[purpose] ?? 'keep') === answer}
                    onChange={() => setAnswers((a) => ({ ...a, [purpose]: answer }))}
                  />
                  {t(`consent.answer.${answer}`)}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <ErrorBanner error={error} />
        <div className="form-actions">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={loading || chosen.length === 0}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
