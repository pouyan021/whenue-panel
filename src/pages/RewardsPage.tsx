import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';

import { Button, Dialog, Empty, ErrorBanner, Field, Loading } from '../components/ui';
import {
  CREATE_REWARD,
  LOYALTY,
  UPDATE_LOYALTY_PROGRAM,
  UPDATE_REWARD,
  type LoyaltyProgram,
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
          <input required inputMode="numeric" value={form.pointsCost} onChange={(e) => set('pointsCost', e.target.value)} />
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
      </ul>
      {editing && <ProgramDialog program={program} onClose={() => setEditing(false)} />}
    </div>
  );
}

const PROGRAM_FIELDS = ['pointsPerVisit', 'pointsPerSpendUnit', 'testimonialPoints', 'referrerPoints', 'friendPoints'] as const;

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
            <input inputMode="numeric" value={form.pointsPerSpendUnit} onChange={(e) => setForm({ ...form, pointsPerSpendUnit: e.target.value })} />
          </Field>
          <Field label={t('program.field.spendUnitToman')}>
            <input inputMode="numeric" value={form.spendUnitToman} onChange={(e) => setForm({ ...form, spendUnitToman: e.target.value })} />
          </Field>
        </div>
        {shown
          .filter((f) => f !== 'pointsPerSpendUnit')
          .map((f) => (
            <Field key={f} label={t(`program.field.${f}`)}>
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
