import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';

import { TierBadge } from '../components/members';
import { Button, Dialog, Empty, ErrorBanner, Field, Loading } from '../components/ui';
import {
  CREATE_LOYALTY_TIER,
  CREATE_REWARD,
  DELETE_LOYALTY_TIER,
  LOYALTY,
  UPDATE_LOYALTY_PROGRAM,
  UPDATE_LOYALTY_TIER,
  UPDATE_REWARD,
  type LoyaltyProgram,
  type LoyaltyTier,
  type Reward,
} from '../graphql/operations';
import { useI18n } from '../i18n/i18n';
import { useFormat } from '../lib/format';
import { parseWholeNumber, rialToToman, tomanToRial } from '../lib/numbers';
import { useCurrentVenue } from '../lib/venue';

export function RewardsPage() {
  const { t } = useI18n();
  const { organization, canManage } = useCurrentVenue();
  const { data, loading, error } = useQuery(LOYALTY, {
    variables: { organizationId: organization.id, includeInactive: canManage },
  });
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const program = data?.organization?.loyaltyProgram;
  const rewards = data?.organization?.rewards ?? [];

  return (
    <section>
      <header className="page-header">
        <h1>{t('rewards.title')}</h1>
        {canManage && (
          <Button variant="primary" onClick={() => setEditing('new')}>
            {t('rewards.new')}
          </Button>
        )}
      </header>
      <p className="muted">{t('rewards.intro')}</p>

      <ErrorBanner error={error} />
      {loading && !data ? (
        <Loading />
      ) : (
        <>
          {rewards.length === 0 ? (
            <Empty>{canManage ? t('rewards.emptyManager') : t('rewards.empty')}</Empty>
          ) : (
            <RewardTable rewards={rewards} onEdit={canManage ? setEditing : undefined} />
          )}
          {program && <ProgramCard program={program} />}
          {data?.organization && <TiersCard tiers={data.organization.tiers} />}
        </>
      )}

      {editing && <RewardDialog reward={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function RewardTable({ rewards, onEdit }: { rewards: Reward[]; onEdit?: (reward: Reward) => void }) {
  const { t } = useI18n();
  const format = useFormat();
  return (
    <table className="table">
      <thead>
        <tr>
          <th>{t('rewards.name')}</th>
          <th>{t('rewards.cost')}</th>
          <th>{t('rewards.state')}</th>
          {onEdit && <th aria-label={t('common.actions')} />}
        </tr>
      </thead>
      <tbody>
        {rewards.map((reward) => (
          <tr key={reward.id}>
            <td>
              <strong>{reward.name}</strong>
              {reward.description && <div className="muted small">{reward.description}</div>}
            </td>
            <td>{format.points(reward.pointsCost)}</td>
            <td>
              <span className={`badge ${reward.active ? 'badge-approved' : 'badge-muted'}`}>
                {reward.active ? t('rewards.active') : t('rewards.inactive')}
              </span>
            </td>
            {onEdit && (
              <td className="row-actions">
                <Button onClick={() => onEdit(reward)}>{t('common.edit')}</Button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RewardDialog({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const { t } = useI18n();
  const { organization } = useCurrentVenue();
  const [create, creation] = useMutation(CREATE_REWARD, { refetchQueries: ['Loyalty'] });
  const [update, updating] = useMutation(UPDATE_REWARD);
  const [form, setForm] = useState({
    name: reward?.name ?? '',
    description: reward?.description ?? '',
    pointsCost: reward?.pointsCost.toString() ?? '',
    active: reward?.active ?? true,
  });
  const cost = parseWholeNumber(form.pointsCost);
  const busy = creation.loading || updating.loading;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!cost) return;
    const input = { name: form.name.trim(), description: form.description.trim() || null, pointsCost: cost };
    const ok = reward
      ? await update({ variables: { id: reward.id, input: { ...input, active: form.active } } }).catch(() => null)
      : await create({ variables: { input: { ...input, organizationId: organization.id } } }).catch(() => null);
    if (ok?.data) onClose();
  }

  return (
    <Dialog title={reward ? t('rewards.edit') : t('rewards.new')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label={t('rewards.name')} hint={t('rewards.nameHint')}>
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('rewards.description')}>
          <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label={t('rewards.cost')}>
          <input
            required
            inputMode="numeric"
            value={form.pointsCost}
            onChange={(e) => set('pointsCost', e.target.value)}
          />
        </Field>
        {reward && (
          <label className="checkbox">
            <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
            {t('rewards.activeHint')}
          </label>
        )}
        <ErrorBanner error={creation.error ?? updating.error} />
        <div className="form-actions">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={busy || !cost}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** How members earn points. Organization admins change it; staff see it to explain it. */
function ProgramCard({ program }: { program: LoyaltyProgram }) {
  const { t } = useI18n();
  const format = useFormat();
  const { canManage, hasModule } = useCurrentVenue();
  const [editing, setEditing] = useState(false);

  return (
    <div className="card program">
      <div className="row">
        <h2>{t('program.title')}</h2>
        {canManage && <Button onClick={() => setEditing(true)}>{t('common.edit')}</Button>}
      </div>
      <ul>
        <li>{t('program.perVisit', { points: format.points(program.pointsPerVisit) })}</li>
        <li>
          {t('program.perSpend', {
            points: format.points(program.pointsPerSpendUnit),
            amount: format.toman(program.spendUnitRial),
          })}
        </li>
        {hasModule('TESTIMONIALS') && (
          <li>{t('program.testimonial', { points: format.points(program.testimonialPoints) })}</li>
        )}
        {hasModule('REFERRALS') && (
          <li>
            {t('program.referral', {
              referrer: format.points(program.referrerPoints),
              friend: format.points(program.friendPoints),
            })}
          </li>
        )}
        {program.birthdayPoints > 0 && (
          <li>{t('program.birthday', { points: format.points(program.birthdayPoints) })}</li>
        )}
      </ul>
      {editing && <ProgramDialog program={program} onClose={() => setEditing(false)} />}
    </div>
  );
}

const PROGRAM_FIELDS = [
  'pointsPerVisit',
  'pointsPerSpendUnit',
  'testimonialPoints',
  'referrerPoints',
  'friendPoints',
  'birthdayPoints',
] as const;

function ProgramDialog({ program, onClose }: { program: LoyaltyProgram; onClose: () => void }) {
  const { t } = useI18n();
  const { organization, hasModule } = useCurrentVenue();
  const [update, { loading, error }] = useMutation(UPDATE_LOYALTY_PROGRAM, { refetchQueries: ['Loyalty'] });
  const [form, setForm] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(PROGRAM_FIELDS.map((f) => [f, String(program[f])])),
    spendUnitToman: String(rialToToman(program.spendUnitRial)),
  }));
  const values = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, parseWholeNumber(v)]));
  const invalid = Object.values(values).some((v) => v == null) || values.spendUnitToman === 0;
  const shown = PROGRAM_FIELDS.filter(
    (f) =>
      (f !== 'testimonialPoints' || hasModule('TESTIMONIALS')) &&
      ((f !== 'referrerPoints' && f !== 'friendPoints') || hasModule('REFERRALS')),
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (invalid) return;
    const input = {
      ...Object.fromEntries(shown.map((f) => [f, values[f]!])),
      spendUnitRial: tomanToRial(values.spendUnitToman!),
    };
    const result = await update({ variables: { organizationId: organization.id, input } }).catch(() => null);
    if (result?.data) onClose();
  }

  return (
    <Dialog title={t('program.title')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">{t('program.intro')}</p>
        <div className="form-row">
          <Field label={t('program.field.pointsPerSpendUnit')}>
            <input
              inputMode="numeric"
              value={form.pointsPerSpendUnit}
              onChange={(e) => setForm({ ...form, pointsPerSpendUnit: e.target.value })}
            />
          </Field>
          <Field label={t('program.field.spendUnitToman')}>
            <input
              inputMode="numeric"
              value={form.spendUnitToman}
              onChange={(e) => setForm({ ...form, spendUnitToman: e.target.value })}
            />
          </Field>
        </div>
        {shown
          .filter((f) => f !== 'pointsPerSpendUnit')
          .map((f) => (
            <Field
              key={f}
              label={t(`program.field.${f}`)}
              hint={f === 'birthdayPoints' ? t('program.birthdayHint') : undefined}
            >
              <input inputMode="numeric" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
            </Field>
          ))}
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

/** Levels members reach by points earned in the last 12 months, each with extra points per visit. */
function TiersCard({ tiers }: { tiers: LoyaltyTier[] }) {
  const { t } = useI18n();
  const format = useFormat();
  const { canManage } = useCurrentVenue();
  const [editing, setEditing] = useState<LoyaltyTier | 'new' | null>(null);
  const [remove, removing] = useMutation(DELETE_LOYALTY_TIER, { refetchQueries: ['Loyalty'] });

  function onDelete(tier: LoyaltyTier) {
    if (!window.confirm(t('tiers.deleteConfirm', { name: tier.name }))) return;
    void remove({ variables: { id: tier.id } }).catch(() => undefined);
  }

  return (
    <div className="card program">
      <div className="row">
        <h2>{t('tiers.title')}</h2>
        {canManage && tiers.length < 6 && <Button onClick={() => setEditing('new')}>{t('tiers.new')}</Button>}
      </div>
      <p className="muted">{t('tiers.intro')}</p>
      {tiers.length === 0 ? (
        <p className="muted">{t('tiers.empty')}</p>
      ) : (
        <table className="table table-plain tier-table">
          <tbody>
            {tiers.map((tier) => (
              <tr key={tier.id}>
                <td>
                  <TierBadge name={tier.name} />
                </td>
                <td>{t('tiers.from', { points: format.points(tier.minPoints) })}</td>
                <td dir="ltr">{t('tiers.bonus', { percent: format.percent(tier.bonusPercent / 100) })}</td>
                {canManage && (
                  <td className="row-actions">
                    <Button onClick={() => setEditing(tier)}>{t('common.edit')}</Button>
                    <Button variant="ghost" disabled={removing.loading} onClick={() => onDelete(tier)}>
                      {t('common.delete')}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ErrorBanner error={removing.error} />
      {editing && <TierDialog tier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TierDialog({ tier, onClose }: { tier: LoyaltyTier | null; onClose: () => void }) {
  const { t } = useI18n();
  const { organization } = useCurrentVenue();
  const [create, creation] = useMutation(CREATE_LOYALTY_TIER, { refetchQueries: ['Loyalty'] });
  const [update, updating] = useMutation(UPDATE_LOYALTY_TIER, { refetchQueries: ['Loyalty'] });
  const [form, setForm] = useState({
    name: tier?.name ?? '',
    minPoints: tier?.minPoints.toString() ?? '',
    bonusPercent: tier?.bonusPercent.toString() ?? '',
  });
  const minPoints = parseWholeNumber(form.minPoints);
  const bonusPercent = parseWholeNumber(form.bonusPercent);
  const invalid = !form.name.trim() || !minPoints || bonusPercent == null || bonusPercent > 200;
  const busy = creation.loading || updating.loading;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (invalid) return;
    const input = { name: form.name.trim(), minPoints: minPoints!, bonusPercent: bonusPercent! };
    const ok = tier
      ? await update({ variables: { id: tier.id, input } }).catch(() => null)
      : await create({ variables: { input: { ...input, organizationId: organization.id } } }).catch(() => null);
    if (ok?.data) onClose();
  }

  return (
    <Dialog title={tier ? t('tiers.edit') : t('tiers.new')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label={t('tiers.name')}>
          <input
            required
            maxLength={64}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="form-row">
          <Field label={t('tiers.minPoints')}>
            <input
              required
              inputMode="numeric"
              value={form.minPoints}
              onChange={(e) => setForm({ ...form, minPoints: e.target.value })}
            />
          </Field>
          <Field label={t('tiers.bonusPercent')}>
            <input
              required
              inputMode="numeric"
              value={form.bonusPercent}
              onChange={(e) => setForm({ ...form, bonusPercent: e.target.value })}
            />
          </Field>
        </div>
        <ErrorBanner error={creation.error ?? updating.error} />
        <div className="form-actions">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={busy || invalid}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
