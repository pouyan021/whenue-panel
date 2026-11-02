import { useMutation } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';

import { CHANGE_MY_PASSWORD } from '../graphql/operations';
import { useI18n } from '../i18n/i18n';
import { useAuth } from '../lib/auth';
import { MIN_PASSWORD_LENGTH } from '../lib/passwords';
import { Button, Dialog, ErrorBanner, Field } from './ui';

/** Staff change their own password; other sessions end, this one carries on with a new token. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const [change, { loading, error, data }] = useMutation(CHANGE_MY_PASSWORD);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const short = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const mismatch = repeat.length > 0 && repeat !== next;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (short || mismatch || next.length === 0) return;
    const result = await change({ variables: { currentPassword: current, newPassword: next } }).catch(() => null);
    if (result?.data) {
      const { token, expiresAt } = result.data.changeMyPassword;
      signIn({ token, expiresAt });
    }
  }

  return (
    <Dialog title={t('password.title')} onClose={onClose}>
      {data ? (
        <>
          <p>{t('password.done')}</p>
          <div className="form-actions">
            <Button variant="primary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </>
      ) : (
        <form className="form" onSubmit={submit}>
          <Field label={t('password.current')}>
            <input
              required
              type="password"
              dir="ltr"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label={t('password.new')} hint={short ? t('staff.passwordShort') : undefined}>
            <input
              required
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={next}
              aria-invalid={short}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label={t('password.repeat')} hint={mismatch ? t('password.mismatch') : undefined}>
            <input
              required
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={repeat}
              aria-invalid={mismatch}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </Field>
          <p className="muted small">{t('password.othersSignedOut')}</p>
          <ErrorBanner error={error} />
          <div className="form-actions">
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" disabled={loading || short || mismatch}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
