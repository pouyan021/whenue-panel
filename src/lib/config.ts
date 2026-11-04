declare global {
  interface Window {
    /** Set by /config.js, which nginx writes from the container's environment. */
    WHENUE_CONFIG?: { visitLinkBase?: string };
  }
}

const runtime = typeof window === 'undefined' ? undefined : window.WHENUE_CONFIG;

// VITE_* variables are inlined at build time. See .env.example.
export const config = {
  graphqlUrl: import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:8080/graphql',
  // An https address lets any phone open the link in its browser; whenue:// needs the app
  visitLinkBase: runtime?.visitLinkBase || import.meta.env.VITE_VISIT_LINK_BASE || 'whenue://visit/',
  pageSize: 24,
};

export function visitLink(token: string, base: string = config.visitLinkBase) {
  return base + encodeURIComponent(token);
}

/** whenue-api's integration API reference, served next to its GraphQL endpoint. */
export function apiDocsUrl(graphqlUrl: string = config.graphqlUrl) {
  return graphqlUrl.replace(/\/graphql\/?$/, '') + '/swagger-ui.html';
}
