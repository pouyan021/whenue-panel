import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { InviteMemberDialog, MemberStatus, Mobile, memberName } from '../components/members';
import { Button, Empty, ErrorBanner, Field, Loading, Stat } from '../components/ui';
import {
  CHECK_IN,
  LOYALTY,
  MEMBER,
  MEMBERS,
  REDEEM_REWARD,
  type CheckInResult,
  type MemberDetail,
  type Redemption,
  type Reward,
} from '../graphql/operations';
import { useI18n } from '../i18n/i18n';
import { useFormat } from '../lib/format';
import { memberIdFromCode, parseWholeNumber, tomanToRial } from '../lib/numbers';
import { useCurrentVenue } from '../lib/venue';

// After a visit or a reward, every view of the member's points is out of date.
const AFTER_POINTS_CHANGE = ['Member', 'Members', 'Visits'];

/** Reception: find the member, record their visit and what they paid, hand over rewards. */
export function CheckInPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const memberId = params.get('member');

  return (
    <section>
      <header className="page-header">
        <h1>{t('checkIn.title')}</h1>
      </header>
      <div className="desk">
        <MemberLookup onPick={(id) => setParams({ member: id })} />
        {memberId ? (
          <DeskMember key={memberId} id={memberId} />
        ) : (
          <Empty>{t('checkIn.pickHint')}</Empty>
        )}
      </div>
    </section>
  );
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Search by name or mobile, or scan the member's card: a USB scanner types its code here. */
function MemberLookup({ onPick }: { onPick: (id: string) => void }) {
  const { t } = useI18n();
  const { organization } = useCurrentVenue();
  const [text, setText] = useState('');
  const [inviting, setInviting] = useState(false);
  const search = useDebounced(text.trim(), 250);
  const scanned = memberIdFromCode(text);
  const { data, loading, error } = useQuery(MEMBERS, {
    variables: { organizationId: organization.id, search, page: 0, size: 8 },
    skip: search.length < 2 || scanned != null,
  });
  const results = data?.members ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    const id = scanned ?? (results.length === 1 ? results[0].id : null);
    if (id) {
      onPick(id);
      setText('');
    }
  }

  return (
    <div className="card lookup">
      <form onSubmit={submit}>
        <Field label={t('checkIn.search')} hint={t('checkIn.searchHint')}>
          <input type="search" autoFocus autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </form>
      <ErrorBanner error={error} />
      {loading && <Loading />}
      {search.length >= 2 && !scanned && !loading && results.length === 0 && (
        <p className="muted">{t('checkIn.noMatch')}</p>
      )}
      {results.length > 0 && (
        <ul className="pick-list">
          {results.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m.id)}>
                <strong>{memberName(m, t('member.noName'))}</strong>
                <Mobile value={m.mobile} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button onClick={() => setInviting(true)}>{t('checkIn.newMember')}</Button>
      {inviting && (
        <InviteMemberDialog
          initialMobile={/^[\d۰-۹+ ]+$/.test(text) ? text : ''}
          onClose={() => setInviting(false)}
          onInvited={(member) => {
            setInviting(false);
            setText('');
            onPick(member.id);
          }}
        />
      )}
    </div>
  );
}

function DeskMember({ id }: { id: string }) {
  const { t } = useI18n();
  const format = useFormat();
  const { data, loading, error } = useQuery(MEMBER, { variables: { id, size: 5 } });
  const member = data?.member;

  if (loading && !member) return <Loading />;
  if (error) return <ErrorBanner error={error} />;
  if (!member) return <Empty>{t('member.notFound')}</Empty>;

  return (
    <div className="desk-member">
      <div className="card">
        <div className="row">
          <div>
            <h2>{memberName(member, t('member.noName'))}</h2>
            <Mobile value={member.mobile} />
          </div>
          <MemberStatus member={member} />
        </div>
        <div className="stats">
          <Stat label={t('member.balance')} value={format.points(member.pointsBalance)} tone="accent" />
          {member.memberSince && <Stat label={t('member.since')} value={format.date(member.memberSince)} />}
        </div>
        <Link to={`/members/${member.id}`}>{t('checkIn.openMember')}</Link>
      </div>
      {member.memberSince ? (
        <>
          <CheckInForm member={member} />
          <RedeemList member={member} />
        </>
      ) : (
        <p className="notice">{t('checkIn.notJoined')}</p>
      )}
    </div>
  );
}

function CheckInForm({ member }: { member: MemberDetail }) {
  const { t } = useI18n();
  const format = useFormat();
  const { venue } = useCurrentVenue();
  const [checkIn, { loading, error }] = useMutation(CHECK_IN, { refetchQueries: AFTER_POINTS_CHANGE });
  const [amount, setAmount] = useState('');
  const [done, setDone] = useState<CheckInResult | null>(null);
  const toman = amount.trim() ? parseWholeNumber(amount) : null;
  const invalid = amount.trim() !== '' && toman == null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (invalid) return;
    const result = await checkIn({
      variables: { input: { venueId: venue.id, memberId: member.id, amountRial: toman == null ? null : tomanToRial(toman) } },
    }).catch(() => null);
    if (result?.data) {
      setDone(result.data.checkIn);
      setAmount('');
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{t('checkIn.visitTitle')}</h2>
      <Field label={t('checkIn.amount')} hint={invalid ? t('checkIn.amountInvalid') : t('checkIn.amountHint')}>
        <input inputMode="numeric" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={invalid} />
      </Field>
      {toman != null && toman > 0 && <p className="muted small">{format.toman(tomanToRial(toman))}</p>}
      <ErrorBanner error={error} />
      {done && (
        <p className="success" role="status">
          {t('checkIn.done', { points: format.points(done.pointsEarned), balance: format.points(done.balance) })}
        </p>
      )}
      <div className="form-actions">
        <Button variant="primary" type="submit" disabled={loading || invalid}>
          {t('checkIn.submit')}
        </Button>
      </div>
    </form>
  );
}

function RedeemList({ member }: { member: MemberDetail }) {
  const { t } = useI18n();
  const format = useFormat();
  const { venue, organization } = useCurrentVenue();
  const rewards = useQuery(LOYALTY, { variables: { organizationId: organization.id, includeInactive: false } });
  const [redeem, { loading, error }] = useMutation(REDEEM_REWARD, { refetchQueries: AFTER_POINTS_CHANGE });
  const [done, setDone] = useState<Redemption | null>(null);
  const list = rewards.data?.organization?.rewards ?? [];

  async function onRedeem(reward: Reward) {
    const name = memberName(member, t('member.noName'));
    if (!window.confirm(t('redeem.confirm', { reward: reward.name, name, points: format.points(reward.pointsCost) }))) return;
    const result = await redeem({ variables: { input: { venueId: venue.id, memberId: member.id, rewardId: reward.id } } }).catch(
      () => null,
    );
    if (result?.data) setDone(result.data.redeemReward);
  }

  return (
    <div className="card">
      <h2>{t('redeem.title')}</h2>
      <ErrorBanner error={rewards.error ?? error} />
      {done && (
        <p className="success" role="status">
          {t('redeem.done', { reward: done.reward.name, points: format.points(done.points) })}
        </p>
      )}
      {rewards.loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <p className="muted">{t('redeem.none')}</p>
      ) : (
        <ul className="reward-list">
          {list.map((reward) => {
            const short = reward.pointsCost - member.pointsBalance;
            return (
              <li key={reward.id}>
                <div>
                  <strong>{reward.name}</strong>
                  <div className="muted small">
                    {format.points(reward.pointsCost)}
                    {short > 0 && <> · {t('redeem.short', { points: format.points(short) })}</>}
                  </div>
                </div>
                <Button disabled={loading || short > 0} onClick={() => void onRedeem(reward)}>
                  {t('redeem.submit')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
