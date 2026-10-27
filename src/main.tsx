import { ApolloProvider } from '@apollo/client/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';

import { App } from './App';
import { I18nProvider } from './i18n/i18n';
import { createApolloClient } from './lib/apollo';
import { AuthProvider } from './lib/auth';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={createApolloClient()}>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </ApolloProvider>
  </StrictMode>,
);
