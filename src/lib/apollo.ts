import { ApolloClient, ApolloLink, CombinedGraphQLErrors, HttpLink, InMemoryCache, ServerError } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';

import { config } from './config';
import { readSession, saveSession } from './session';

const authLink = new SetContextLink((prevContext) => {
  const session = readSession();
  if (!session) return prevContext;
  return { headers: { ...prevContext.headers, authorization: `Bearer ${session.token}` } };
});

// whenue-api answers a missing token with UNAUTHENTICATED, and a token it no longer accepts (expired,
// or the account was switched off or changed) with HTTP 401; either way, back to login.
const signOutLink = new ErrorLink(({ error }) => {
  const unauthenticated =
    (CombinedGraphQLErrors.is(error) && error.errors.some((e) => e.extensions?.errorType === 'UNAUTHENTICATED')) ||
    (ServerError.is(error) && error.statusCode === 401);
  if (unauthenticated && readSession()) {
    saveSession(null);
  }
});

export function createApolloClient(uri: string = config.graphqlUrl) {
  return new ApolloClient({
    link: ApolloLink.from([signOutLink, authLink, new HttpLink({ uri })]),
    cache: new InMemoryCache(),
  });
}
