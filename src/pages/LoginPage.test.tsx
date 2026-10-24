import { MockedProvider } from '@apollo/client/testing/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphQLError } from 'graphql';
import { describe, expect, it } from 'vitest';

import { LOGIN } from '../graphql/operations';
import { AuthProvider } from '../lib/auth';
import { readSession } from '../lib/session';
import { staff } from '../test/render';
import { LoginPage } from './LoginPage';

const variables = { email: 'staff@cafe.test', password: 'secret-password' };

function renderLogin(result: object) {
  render(
    <MockedProvider mocks={[{ request: { query: LOGIN, variables }, result }]}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
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
    renderLogin({
      data: { login: { token: 'jwt', expiresAt: '2099-01-01T00:00:00Z', staff: { ...staff, __typename: 'StaffAccount' } } },
    });

    await signIn();

    await expect.poll(() => readSession()?.token).toBe('jwt');
  });

  it('shows the error for a wrong password', async () => {
    renderLogin({ errors: [new GraphQLError('Invalid email or password')] });

    await signIn();

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(readSession()).toBeNull();
  });
});
