import { useMutation } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';

import { INVITE_MEMBER, type MemberSummary } from '../graphql/operations';
import { useI18n } from '../i18n/i18n';
import { nationalMobile, toLatinDigits, toPersianDigits } from '../lib/numbers';
import { useCurrentVenue } from '../lib/venue';
import { Button, Dialog, ErrorBanner, Field } from './ui';

/** A mobile number as people in Iran write it, kept left to right inside Persian text. */
export function Mobile({ value }: { value: string | null }) {
  const { lang } = useI18n();
  if (!value) return null;
  const text = nationalMobile(value);
  return (
    <span dir="ltr" className="mobile">
      {lang === 'fa' ? toPersianDigits(text) : text}
    </span>
  );
}

export function MemberStatus({ member }: { member: Pick<MemberSummary, 'memberSince'> }) {
  const { t } = useI18n();
  return member.memberSince ? (
    <span className="badge badge-approved">{t('member.status.member')}</span>
  ) : (
    <span className="badge badge-pending">{t('member.status.invited')}</span>
  );
}

export function memberName(member: Pick<MemberSummary, 'name'>, fallback: string) {
  return member.name?.trim() || fallback;
}

/** Adds someone at reception; they get a text inviting them to join and must accept it themselves. */
export function InviteMemberDialog({
  initialMobile = '',
  onClose,
  onInvited,
}: {
  initialMobile?: string;
  onClose: () => void;
  onInvited: (member: MemberSummary) => void;
}) {
  const { t } = useI18n();
  const { organization } = useCurrentVenue();
  const [invite, { loading, error }] = useMutation(INVITE_MEMBER, { refetchQueries: ['Members'] });
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState(initialMobile);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await invite({
      variables: { input: { organizationId: organization.id, name: name.trim(), mobile: toLatinDigits(mobile.trim()) } },
    }).catch(() => null);
    if (result?.data) onInvited(result.data.inviteMember);
  }

  return (
    <Dialog title={t('invite.title')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">{t('invite.intro')}</p>
        <Field label={t('member.name')}>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('member.mobile')} hint={t('invite.mobileHint')}>
          <input
            required
            type="tel"
            dir="ltr"
            inputMode="tel"
            autoComplete="off"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
        </Field>
        <ErrorBanner error={error} />
        <div className="form-actions">
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {t('invite.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
