import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';

import { I18nProvider } from '../i18n/i18n';
import { ErrorBoundary, PageCrashed, PanelCrashed } from './ErrorBoundary';
import { OfflineBanner } from './OfflineBanner';

let broken = true;

function Page() {
  if (broken) throw new Error('boom');
  return <p>Members</p>;
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the crash card in place of a broken page and retries it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    broken = true;
    render(
      <I18nProvider lang="en">
        <nav>Menu</nav>
        <ErrorBoundary fallback={(reset) => <PageCrashed onRetry={reset} />}>
          <Page />
        </ErrorBoundary>
      </I18nProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByText('Menu')).toBeInTheDocument();

    broken = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Members')).toBeInTheDocument();
  });
});

describe('inside the router', () => {
  afterEach(() => vi.restoreAllMocks());

  it('catches a page crash before the router does, so the menu stays', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    broken = true;
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <>
              <nav>Menu</nav>
              <ErrorBoundary fallback={(reset) => <PageCrashed onRetry={reset} />}>
                <Outlet />
              </ErrorBoundary>
            </>
          ),
          errorElement: <PanelCrashed />,
          children: [{ path: 'members', element: <Page /> }],
        },
      ],
      { initialEntries: ['/members'] },
    );
    render(
      <I18nProvider lang="en">
        <RouterProvider router={router} />
      </I18nProvider>,
    );
    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.getByText(/This page hit a problem/)).toBeInTheDocument();
  });
});

describe('OfflineBanner', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows while the browser is offline', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(
      <I18nProvider lang="en">
        <OfflineBanner />
      </I18nProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();

    onLine.mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent('No internet connection');

    onLine.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
