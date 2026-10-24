import { useMutation } from '@apollo/client/react';
import { useState, type FormEvent } from 'react';

import { Button, ErrorBanner, Field } from '../components/ui';
import { LOGIN } from '../graphql/operations';
import { useAuth } from '../lib/auth';

export function LoginPage() {
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
        <h1>Whenue</h1>
        <p className="muted">Sign in to review your venue's testimonials.</p>
        <Field label="Email">
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
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
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
