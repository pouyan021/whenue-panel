import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';

import { Shell } from './components/Shell';
import { useAuth } from './lib/auth';
import { CampaignsPage } from './pages/CampaignsPage';
import { LoginPage } from './pages/LoginPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TestimonialsPage } from './pages/TestimonialsPage';
import { VenuePage } from './pages/VenuePage';
import { VisitsPage } from './pages/VisitsPage';

export const routes = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/testimonials" replace /> },
      { path: 'testimonials', element: <TestimonialsPage /> },
      { path: 'visits', element: <VisitsPage /> },
      { path: 'campaigns', element: <CampaignsPage /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'venue', element: <VenuePage /> },
      { path: '*', element: <Navigate to="/testimonials" replace /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  const { session } = useAuth();
  return session ? <RouterProvider router={router} /> : <LoginPage />;
}
