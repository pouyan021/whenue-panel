# whenue-panel

Web panel for venue managers on the Whenue video testimony platform. Staff sign in with their
whenue-api account and:

- **Review testimonials**: watch each visitor's video, approve or reject it, and clear approved
  ones for marketing use. Tabs show how many are waiting.
- **Add visits and hand out links**: enter the visitor's name and email, then copy or email the
  `whenue://visit/<token>` link that opens [whenue-app](https://github.com/pouyan021/whenue-app).
- **Run campaigns** and edit the **message templates** they use (text, incentive, link lifetime).
- **Edit the venue's details**.

Venue staff only ever see their own venue. Admins get a venue picker.

Stack: Vite, React 19, TypeScript, Apollo Client 4, React Router. Tests use Vitest and Testing
Library.

## Running locally

1. Start [whenue-api](https://github.com/pouyan021/whenue-api) (`./gradlew bootRun` starts
   Postgres, RustFS and RabbitMQ from its `compose.yaml`). Set
   `WHENUE_BOOTSTRAP_ADMIN_EMAIL` and `WHENUE_BOOTSTRAP_ADMIN_PASSWORD` the first time to get an
   admin account. The API allows `http://localhost:5173` cross-origin by default.
2. Here:

   ```sh
   cp .env.example .env.local   # only if the API isn't on http://localhost:8080
   npm install
   npm run dev                  # http://localhost:5173
   ```

3. Sign in as the admin, or create venue staff with the API's `createStaffAccount` mutation
   (role `VENUE_STAFF` and a `venueId`).

Videos play from short-lived signed URLs on the S3 server (`WHENUE_S3_PUBLIC_ENDPOINT` in the
API), so the browser must be able to reach that host.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `VITE_GRAPHQL_URL` | `http://localhost:8080/graphql` | whenue-api's GraphQL endpoint. |
| `VITE_VISIT_LINK_BASE` | `whenue://visit/` | Prefix of visitor links; the token is appended. |

These are inlined at build time. For a deployment, also add the panel's origin to the API's
`WHENUE_CORS_ALLOWED_ORIGINS`.

## Container image

The `Dockerfile` builds the panel with `VITE_GRAPHQL_URL=/graphql` and serves it from nginx on port
8080, which forwards `/graphql` to `API_UPSTREAM` (default `http://whenue-api:8080`). The same image
therefore works in every environment and the API needs no CORS entry for it. CI pushes it to
`ghcr.io/pouyan021/whenue-panel` on every merge to `main`; whenue-deploy runs it.

## Scripts

```sh
npm run dev        # dev server
npm run lint
npm run typecheck
npm test           # Vitest
npm run build      # typecheck + production bundle in dist/
```

## Layout

```
src/
  main.tsx, App.tsx       Apollo, auth and routes
  lib/                    config, session (token in localStorage), Apollo client, current venue
  graphql/operations.ts   queries and mutations, typed by hand against whenue-api's schema
  components/             app shell, testimonial dialog, small UI pieces
  pages/                  login, testimonials, visits, campaigns, templates, venue
```
