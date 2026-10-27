import { useMutation } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';

import { LanguageSwitch } from '../components/Shell';
import { Button, ErrorBanner, Field } from '../components/ui';
import { LOGIN } from '../graphql/operations';
import { useI18n } from '../i18n/i18n';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { loading, error }] = useMutation(LOGIN);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data } = await login({ variables: { email: email.trim(), password } }).catch(() => ({ data: undefined }));
    if (data) signIn({ token: data.login.token, expiresAt: data.login.expiresAt });
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <h1>{t('login.title')}</h1>
        <p className="muted">{t('login.intro')}</p>
        <Field label={t('login.email')}>
          <input type="email" dir="ltr" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('login.password')}>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorBanner error={error} />
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? t('login.signingIn') : t('login.signIn')}
        </Button>
        <LanguageSwitch />
      </form>
    </main>
  );
}
