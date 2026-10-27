import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';

import { Shell } from './components/Shell';
import { useAuth } from './lib/auth';
import { CampaignsPage } from './pages/CampaignsPage';
import { CheckInPage } from './pages/CheckInPage';
import { ClubPage } from './pages/ClubPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { LoginPage } from './pages/LoginPage';
import { MemberPage } from './pages/MemberPage';
import { MembersPage } from './pages/MembersPage';
import { RewardsPage } from './pages/RewardsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TestimonialsPage } from './pages/TestimonialsPage';
import { VenuePage } from './pages/VenuePage';
import { VisitsPage } from './pages/VisitsPage';

export const routes = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/check-in" replace /> },
      { path: 'check-in', element: <CheckInPage /> },
      { path: 'members', element: <MembersPage /> },
      { path: 'members/:id', element: <MemberPage /> },
      { path: 'rewards', element: <RewardsPage /> },
      { path: 'testimonials', element: <TestimonialsPage /> },
      { path: 'visits', element: <VisitsPage /> },
      { path: 'campaigns', element: <CampaignsPage /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'branch', element: <VenuePage /> },
      { path: 'club', element: <ClubPage /> },
      { path: 'integrations', element: <IntegrationsPage /> },
      { path: 'venue', element: <Navigate to="/branch" replace /> },
      { path: '*', element: <Navigate to="/check-in" replace /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  const { session } = useAuth();
  return session ? <RouterProvider router={router} /> : <LoginPage />;
}
