import { ApolloProvider } from '@apollo/client/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { createApolloClient } from './lib/apollo';
import { AuthProvider } from './lib/auth';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={createApolloClient()}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ApolloProvider>
  </StrictMode>,
);
