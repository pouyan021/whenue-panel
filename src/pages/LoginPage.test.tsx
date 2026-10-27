import { MockedProvider } from '@apollo/client/testing/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { describe, expect, it } from 'vitest';

import { LOGIN } from '../graphql/operations';
import { I18nProvider, type Lang } from '../i18n/i18n';
import { AuthProvider } from '../lib/auth';
import { readSession } from '../lib/session';
import { LoginPage } from './LoginPage';

const variables = { email: 'staff@luna.test', password: 'secret-password' };

function renderLogin(result: object, lang: Lang | null = 'en') {
  render(
    <MockedProvider mocks={[{ request: { query: LOGIN, variables }, result }]}>
      <I18nProvider lang={lang ?? undefined}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </I18nProvider>
    </MockedProvider>,
  );
}

async function signIn() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), ` ${variables.email} `);
  await user.type(screen.getByLabelText('Password'), variables.password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginPage', () => {
  it('stores the session after a successful login', async () => {
    renderLogin({ data: { login: { __typename: 'AuthPayload', token: 'jwt', expiresAt: '2099-01-01T00:00:00Z' } } });

    await signIn();

    await expect.poll(() => readSession()?.token).toBe('jwt');
  });

  it('shows the error for a wrong password', async () => {
    renderLogin({ errors: [new GraphQLError('Invalid email or password')] });

    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(readSession()).toBeNull();
  });

  it('is in Persian, right to left, until someone picks English', async () => {
    renderLogin({ data: null }, null);

    expect(screen.getByRole('button', { name: 'ورود' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');

    await userEvent.setup().click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(localStorage.getItem('whenue.lang')).toBe('en');
  });
});
