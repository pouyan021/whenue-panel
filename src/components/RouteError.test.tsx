import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../i18n/i18n';
import { RouteError } from './RouteError';

function Broken(): never {
  throw new Error('boom');
}

function renderRoutes(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <><Link to="/fine">Fine</Link><Outlet /></>,
        children: [
          {
            errorElement: <RouteError />,
            children: [
              { path: 'broken', element: <Broken /> },
              { path: 'fine', element: <p>Fine page</p> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(
    <I18nProvider lang="en">
      <RouterProvider router={router} />
    </I18nProvider>,
  );
}

describe('RouteError', () => {
  it('shows a generic message and keeps the frame when a page crashes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderRoutes('/broken');

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.queryByText('boom')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Fine' }));
    expect(await screen.findByText('Fine page')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
