// VITE_* variables are inlined at build time. See .env.example.
export const config = {
  graphqlUrl: import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:8080/graphql',
  visitLinkBase: import.meta.env.VITE_VISIT_LINK_BASE ?? 'whenue://visit/',
  pageSize: 24,
};

export function visitLink(token: string, base: string = config.visitLinkBase) {
  return base + encodeURIComponent(token);
}
