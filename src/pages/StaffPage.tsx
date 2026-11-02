import { useMutation, useQuery } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';

import { Button, Dialog, Empty, ErrorBanner, Field, Loading } from '../components/ui';
import {
  CREATE_STAFF_ACCOUNT,
  SET_STAFF_PASSWORD,
  STAFF_ACCOUNTS,
  UPDATE_STAFF_ACCOUNT,
  VENUES,
  type StaffAccount,
  type StaffRole,
} from '../graphql/operations';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/i18n';
import { useFormat } from '../lib/format';
import { generatePassword, MIN_PASSWORD_LENGTH } from '../lib/passwords';
import { useCurrentVenue } from '../lib/venue';

const REFETCH = ['StaffAccounts'];

export const ROLE_LABEL: Record<StaffRole, MessageKey> = {
  ADMIN: 'staff.role.admin',
  ORG_ADMIN: 'staff.role.orgAdmin',
  VENUE_STAFF: 'staff.role.venueStaff',
};

/** Clinic owners add reception accounts, move them between branches, switch them off and reset passwords. */
export function StaffPage() {
  const { t } = useI18n();
  const { organization } = useCurrentVenue();
  const { data, loading, error } = useQuery(STAFF_ACCOUNTS, { variables: { organizationId: organization.id } });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [resetting, setResetting] = useState<StaffAccount | null>(null);
  const accounts = data?.staffAccounts ?? [];

  return (
    <section>
      <header className="page-header">
        <h1>{t('staff.title')}</h1>
        <Button variant="primary" onClick={() => setAdding(true)}>
          {t('staff.add')}
        </Button>
      </header>
      <p className="muted">{t('staff.intro')}</p>

      <ErrorBanner error={error} />
      {loading && !data ? (
        <Loading />
      ) : accounts.length === 0 ? (
        <Empty>{t('staff.empty')}</Empty>
      ) : (
        <StaffTable accounts={accounts} onEdit={setEditing} onReset={setResetting} />
      )}

      {adding && <AddStaffDialog onClose={() => setAdding(false)} />}
      {editing && <EditStaffDialog account={editing} onClose={() => setEditing(null)} />}
      {resetting && <ResetPasswordDialog account={resetting} onClose={() => setResetting(null)} />}
    </section>
  );
}

function StaffTable({
  accounts,
  onEdit,
  onReset,
}: {
  accounts: StaffAccount[];
  onEdit: (account: StaffAccount) => void;
  onReset: (account: StaffAccount) => void;
}) {
  const { t } = useI18n();
  const format = useFormat();
  const { me } = useCurrentVenue();
  return (
    <table className="table">
      <thead>
        <tr>
          <th>{t('staff.email')}</th>
          <th>{t('staff.role')}</th>
          <th>{t('staff.branch')}</th>
          <th>{t('staff.status')}</th>
          <th aria-label={t('common.actions')} />
        </tr>
      </thead>
      <tbody>
        {accounts.map((account) => {
          const self = account.id === me.id;
          return (
            <tr key={account.id} className={account.enabled ? undefined : 'row-muted'}>
              <td dir="ltr" className="staff-email">
                {account.email}
                {self && <span className="muted small"> ({t('staff.you')})</span>}
                <div className="muted small">{t('staff.since', { date: format.date(account.createdAt) })}</div>
              </td>
              <td>{t(ROLE_LABEL[account.role])}</td>
              <td>{account.venue?.name ?? <span className="muted">{t('staff.allBranches')}</span>}</td>
              <td>
                <span className={`badge ${account.enabled ? 'badge-approved' : 'badge-muted'}`}>
                  {account.enabled ? t('staff.active') : t('staff.disabled')}
                </span>
              </td>
              <td className="row-actions">
                {!self && (
                  <>
                    <Button onClick={() => onEdit(account)}>{t('common.edit')}</Button>
                    <Button variant="ghost" onClick={() => onReset(account)}>
                      {t('staff.resetPassword')}
                    </Button>
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

function useBranches() {
  const { organization } = useCurrentVenue();
  const venues = useQuery(VENUES, { variables: { size: 200 } }).data?.venues ?? [];
  return venues.filter((v) => v.organization.id === organization.id);
}

function RoleAndBranch({
  role,
  venueId,
  onRole,
  onVenue,
}: {
  role: StaffRole;
  venueId: string;
  onRole: (role: StaffRole) => void;
  onVenue: (id: string) => void;
}) {
  const { t } = useI18n();
  const branches = useBranches();
  return (
    <>
      <fieldset className="role-choice">
        <legend className="field-label">{t('staff.role')}</legend>
        {(['VENUE_STAFF', 'ORG_ADMIN'] as const).map((value) => (
          <label key={value} className="checkbox">
            <input type="radio" name="role" checked={role === value} onChange={() => onRole(value)} />
            <span>
              {t(ROLE_LABEL[value])}
              <span className="muted small">
                {' '}
                · {t(value === 'ORG_ADMIN' ? 'staff.orgAdminHint' : 'staff.venueStaffHint')}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {role === 'VENUE_STAFF' && (
        <Field label={t('staff.branch')}>
          <select required value={venueId} onChange={(e) => onVenue(e.target.value)}>
            <option value="">{t('staff.pickBranch')}</option>
            {branches.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  );
}

function AddStaffDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { organization, venue } = useCurrentVenue();
  const [create, { data, loading, error }] = useMutation(CREATE_STAFF_ACCOUNT, { refetchQueries: REFETCH });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<StaffRole>('VENUE_STAFF');
  const [venueId, setVenueId] = useState(venue.id);
  const invalid = password.length < MIN_PASSWORD_LENGTH || (role === 'VENUE_STAFF' && !venueId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (invalid) return;
    await create({
      variables: {
        input: {
          email: email.trim(),
          password,
          role,
          organizationId: role === 'ORG_ADMIN' ? organization.id : null,
          venueId: role === 'VENUE_STAFF' ? venueId : null,
        },
      },
    }).catch(() => null);
  }

  if (data) {
    return (
      <Dialog title={t('staff.add')} onClose={onClose}>
        <SignInDetails email={data.createStaffAccount.email} password={password} />
        <div className="form-actions">
          <Button variant="primary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title={t('staff.add')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label={t('staff.email')}>
          <input
            required
            type="email"
            dir="ltr"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <RoleAndBranch role={role} venueId={venueId} onRole={setRole} onVenue={setVenueId} />
        <PasswordField value={password} onChange={setPassword} />
        <ErrorBanner error={error} />
        <div className="form-actions">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={loading || invalid}>
            {t('staff.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function EditStaffDialog({ account, onClose }: { account: StaffAccount; onClose: () => void }) {
  const { t } = useI18n();
  const [update, { loading, error }] = useMutation(UPDATE_STAFF_ACCOUNT, { refetchQueries: REFETCH });
  const [role, setRole] = useState<StaffRole>(account.role === 'ORG_ADMIN' ? 'ORG_ADMIN' : 'VENUE_STAFF');
  const [venueId, setVenueId] = useState(account.venue?.id ?? '');
  const [enabled, setEnabled] = useState(account.enabled);
  const invalid = role === 'VENUE_STAFF' && !venueId;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (invalid) return;
    if (!enabled && account.enabled && !window.confirm(t('staff.disableConfirm', { email: account.email }))) return;
    const input = { role, enabled, ...(role === 'VENUE_STAFF' ? { venueId } : {}) };
    const result = await update({ variables: { id: account.id, input } }).catch(() => null);
    if (result?.data) onClose();
  }

  return (
    <Dialog title={t('staff.edit')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p dir="ltr" className="staff-email">
          <strong>{account.email}</strong>
        </p>
        <RoleAndBranch role={role} venueId={venueId} onRole={setRole} onVenue={setVenueId} />
        <label className="checkbox">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t('staff.enabledHint')}
        </label>
        <p className="muted small">{t('staff.signsOut')}</p>
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

function ResetPasswordDialog({ account, onClose }: { account: StaffAccount; onClose: () => void }) {
  const { t } = useI18n();
  const [reset, { data, loading, error }] = useMutation(SET_STAFF_PASSWORD);
  const [password, setPassword] = useState(() => generatePassword());

  async function submit(event: FormEvent) {
    event.preventDefault();
    await reset({ variables: { id: account.id, password } }).catch(() => null);
  }

  return (
    <Dialog title={t('staff.resetPassword')} onClose={onClose}>
      {data ? (
        <>
          <SignInDetails email={account.email} password={password} />
          <div className="form-actions">
            <Button variant="primary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </>
      ) : (
        <form className="form" onSubmit={submit}>
          <p className="muted">{t('staff.resetIntro', { email: account.email })}</p>
          <PasswordField value={password} onChange={setPassword} />
          <ErrorBanner error={error} />
          <div className="form-actions">
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" disabled={loading || password.length < MIN_PASSWORD_LENGTH}>
              {t('staff.resetPassword')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function PasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  const short = value.length < MIN_PASSWORD_LENGTH;
  return (
    <Field label={t('staff.password')} hint={short ? t('staff.passwordShort') : t('staff.passwordHint')}>
      <span className="input-with-button">
        <input
          required
          dir="ltr"
          autoComplete="new-password"
          value={value}
          aria-invalid={short}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button onClick={() => onChange(generatePassword())}>{t('staff.generate')}</Button>
      </span>
    </Field>
  );
}

/** What to hand the person: shown once, since the panel never sees the password again. */
function SignInDetails({ email, password }: { email: string; password: string }) {
  const { t } = useI18n();
  const text = `${email}\n${password}`;
  return (
    <div className="secret">
      <p className="secret-warning">{t('staff.shareOnce')}</p>
      <dl className="sign-in-details" dir="ltr">
        <dt>{t('staff.email')}</dt>
        <dd>{email}</dd>
        <dt>{t('staff.password')}</dt>
        <dd>
          <code>{password}</code>
        </dd>
      </dl>
      <Button onClick={() => void navigator.clipboard?.writeText(text)}>{t('common.copy')}</Button>
    </div>
  );
}
