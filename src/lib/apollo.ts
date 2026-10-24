import { ApolloClient, ApolloLink, CombinedGraphQLErrors, HttpLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';

import { config } from './config';
import { readSession, saveSession } from './session';

const authLink = new SetContextLink((prevContext) => {
  const session = readSession();
  if (!session) return prevContext;
  return { headers: { ...prevContext.headers, authorization: `Bearer ${session.token}` } };
});

// whenue-api answers an expired or missing token with UNAUTHENTICATED; send the user back to login.
const signOutLink = new ErrorLink(({ error }) => {
  if (
    CombinedGraphQLErrors.is(error) &&
    error.errors.some((e) => e.extensions?.errorType === 'UNAUTHENTICATED') &&
    readSession()
  ) {
    saveSession(null);
  }
});

export function createApolloClient(uri: string = config.graphqlUrl) {
  return new ApolloClient({
    link: ApolloLink.from([signOutLink, authLink, new HttpLink({ uri })]),
    cache: new InMemoryCache(),
  });
}
